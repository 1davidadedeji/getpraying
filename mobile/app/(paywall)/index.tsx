import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack, useFocusEffect, useLocalSearchParams, usePathname, type Href } from "expo-router";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { goBackOrFallback } from "@/lib/goBackOrFallback";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalUrls";
import { openLegalDocument } from "@/lib/openLegalDocument";
import { resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import { navigatePostAuth } from "@/lib/postAuthNavigator";
import {
  consumePendingNotificationHref,
  applyNotificationHref,
} from "@/lib/notificationNavigation";
import { hasPremiumEntitlement } from "@/lib/revenuecatEntitlements";
import {
  describeEntitlementAfterPurchase,
  isPurchaseAlreadyOwnedError,
  isPurchaseUserCancelled,
  purchaseErrorMessage,
} from "@/lib/revenuecatPurchase";
import { logoutThenClearQueryCache } from "@/lib/safeLogout";
import { restorePurchasesWithFeedback } from "@/lib/restorePurchases";
import { consumePremiumPlayAfterSubscribe } from "@/lib/premiumUnlockSession";
import { clamp } from "@/lib/responsiveMetrics";

const PREMIUM_FEATURES = [
  { icon: "flash" as const, label: "Unlimited Prayer Boosts" },
  { icon: "star" as const, label: "Exclusive premium library" },
  { icon: "heart" as const, label: "Support the community" },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const { user, logout } = useAuth();
  const rc = useRevenueCat();
  const queryClient = useQueryClient();
  const { pendingDeepLink, consumePendingHref } = usePendingDeepLink();
  const { soft, source } = useLocalSearchParams<{ soft?: string; source?: string }>();
  const pathname = usePathname();
  const isSoftPaywall = soft === "1" || soft === "true";
  const fromPremiumContent = source === "premiumContent";
  const entitlementRedirected = useRef(false);
  const signingOut = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const userRef = useRef(user);
  const rcRef = useRef(rc);
  const pendingDeepLinkRef = useRef(pendingDeepLink);
  const consumePendingHrefRef = useRef(consumePendingHref);
  const pathnameRef = useRef(pathname);

  userRef.current = user;
  rcRef.current = rc;
  pendingDeepLinkRef.current = pendingDeepLink;
  consumePendingHrefRef.current = consumePendingHref;
  pathnameRef.current = pathname;

  const isCheckingSubscription = rc.isCheckingSubscription;
  const isMandatoryGate = false;

  const enterApp = useCallback(() => {
    if (entitlementRedirected.current) return;
    entitlementRedirected.current = true;

    const u = userRef.current;
    const rcState = rcRef.current;
    const consume = consumePendingHrefRef.current;

    if (!u) {
      router.replace("/(tabs)" as Href);
      return;
    }
    const deepHref = consume();
    if (deepHref) {
      applyNotificationHref(deepHref, pathnameRef.current);
      return;
    }
    const notifHref = consumePendingNotificationHref();
    if (notifHref) {
      applyNotificationHref(notifHref, pathnameRef.current);
      return;
    }
    const route = resolvePostAuthNavigation(
      u,
      rcState,
      pendingDeepLinkRef.current,
      () => null,
    );
    if (!route) return;
    navigatePostAuth(route);
  }, []);

  const leavePaywall = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await logoutThenClearQueryCache(logout, queryClient);
  }, [logout, queryClient]);

  const dismissPaywall = useCallback(() => {
    goBackOrFallback((userRef.current ? "/(tabs)" : "/") as Href);
  }, []);

  const finishAfterEntitlement = useCallback(
    (opts?: { haptic?: boolean }) => {
      if (opts?.haptic !== false) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (isSoftPaywall) {
        dismissPaywall();
        if (fromPremiumContent) {
          setTimeout(() => {
            consumePremiumPlayAfterSubscribe();
          }, 350);
        }
        return;
      }
      enterApp();
    },
    [dismissPaywall, enterApp, fromPremiumContent, isSoftPaywall],
  );

  useEffect(() => {
    if (!signingOut.current || user !== null) return;
    signingOut.current = false;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [user]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissPaywall();
      return true;
    });
    return () => sub.remove();
  }, [dismissPaywall]);

  useEffect(() => {
    if (isCheckingSubscription || entitlementRedirected.current) return;
    if (!user) return;
    if (rc.enabled && !rc.isEntitled) return;
    enterApp();
  }, [isCheckingSubscription, user, rc.enabled, rc.isEntitled, rc.isReady, enterApp]);

  useFocusEffect(
    useCallback(() => {
      if (!rc.isEntitled) {
        entitlementRedirected.current = false;
      }
      if (!rc.enabled || rc.hasMonthlyOffer) return;
      void rc.loadCatalog();
    }, [rc.enabled, rc.hasMonthlyOffer, rc.isEntitled, rc.loadCatalog]),
  );

  const onPurchase = async () => {
    if (!rc.hasMonthlyOffer || purchasing) return;

    if (rc.isPremiumTrial) {
      const manageUrl = rc.customerInfo?.managementURL;
      if (manageUrl) {
        try {
          await Linking.openURL(manageUrl);
        } catch {
          showAppAlert({
            title: "Subscription active",
            message: "You're on a free trial — Boost and all premium features are already included.",
          });
        }
        return;
      }
      showAppAlert({
        title: "Subscription active",
        message: "You're on a free trial — Boost and all premium features are already included.",
      });
      return;
    }

    if (rc.isEntitled && hasPremiumEntitlement(rc.customerInfo)) {
      finishAfterEntitlement();
      return;
    }

    setPurchasing(true);
    try {
      await rc.purchaseMonthly();
      finishAfterEntitlement();
    } catch (e: unknown) {
      if (isPurchaseUserCancelled(e)) return;

      if (isPurchaseAlreadyOwnedError(e)) {
        const info = await rc.refresh();
        const { isTrial } = describeEntitlementAfterPurchase(info);
        if (isTrial) {
          showAppAlert({
            title: "Subscription already active",
            message: "You're on a free trial — Boost and all premium features are already included.",
          });
          return;
        }
        if (hasPremiumEntitlement(info)) {
          finishAfterEntitlement();
          return;
        }
      }

      const msg = purchaseErrorMessage(e, "Purchase cancelled or failed.");
      showAppAlert({ title: "Could not start subscription", message: msg });
    } finally {
      setPurchasing(false);
    }
  };

  const onRestore = async () => {
    if (restoring || purchasing) return;
    setRestoring(true);
    try {
      const result = await restorePurchasesWithFeedback({
        restore: rc.restore,
        user: userRef.current,
        rc: { enabled: rc.enabled, customerInfo: rc.customerInfo },
      });
      showAppAlert({ title: result.title, message: result.message });
      if (result.ok) {
        finishAfterEntitlement({ haptic: false });
      }
    } finally {
      setRestoring(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const padH = gutter;
  const edgePad = Math.round(clamp(20 * uiScale, 16, 24));
  const emblemSize = Math.round(clamp(72 * uiScale, 64, 80));
  const emblemIcon = Math.round(clamp(34 * uiScale, 30, 38));
  const fsTitle = Math.round(clamp(28 * uiScale, 24, 32));
  const fsPrice = Math.round(clamp(36 * uiScale, 32, 42));
  const fsPriceUnit = Math.round(clamp(15 * uiScale, 14, 17));
  const fsFeature = Math.round(clamp(15 * uiScale, 14, 17));
  const fsFine = Math.round(clamp(12 * uiScale, 11, 13));
  const fsLink = Math.round(clamp(13 * uiScale, 12, 15));
  const fsBack = Math.round(clamp(15 * uiScale, 14, 17));
  const featureGap = Math.round(clamp(14 * uiScale, 12, 16));
  const featureIcon = Math.round(clamp(18 * uiScale, 16, 20));
  const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const btnRad = Math.round(clamp(32 * uiScale, 28, 36));
  const fsBtn = Math.round(clamp(16 * uiScale, 15, 18));
  const contentGap = Math.round(clamp(24 * uiScale, 20, 28));

  const subscribed = rc.isPremiumTrial || (rc.isEntitled && hasPremiumEntitlement(rc.customerInfo));

  if (isCheckingSubscription) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <LinearGradient colors={["#1A1F36", "#252B45"]} style={[styles.flex, styles.centered, { paddingTop: topPad, paddingBottom: botPad }]}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { fontSize: fsFeature, marginTop: 12 }]}>
            Checking subscription…
          </Text>
          <Pressable
            onPress={() => void leavePaywall()}
            style={{ paddingVertical: 12, marginTop: edgePad }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            testID="paywall-checking-sign-out"
          >
            <Text style={[styles.footerMuted, { fontSize: fsLink }]}>Sign Out</Text>
          </Pressable>
        </LinearGradient>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: !isMandatoryGate,
          fullScreenGestureEnabled: !isMandatoryGate,
        }}
      />
      <LinearGradient colors={["#1A1F36", "#252B45", "#1A1F36"]} style={styles.flex}>
        <View style={[styles.header, { paddingTop: topPad, paddingHorizontal: padH }]}>
          <Pressable
            onPress={dismissPaywall}
            style={styles.closeBtn}
            testID="paywall-close"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
            <Text style={[styles.closeText, { fontSize: fsBack }]}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: padH, paddingBottom: edgePad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { gap: contentGap }]}>
            <View
              style={[
                styles.emblem,
                {
                  width: emblemSize,
                  height: emblemSize,
                  borderRadius: emblemSize / 2,
                },
              ]}
            >
              <Ionicons name="star" size={emblemIcon} color={colors.accent} />
            </View>

            <View style={styles.titleBlock}>
              <Text style={[styles.title, { fontSize: fsTitle }]}>
                {subscribed ? "You're Premium" : "Get Praying Premium"}
              </Text>
              {!subscribed && (
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { fontSize: fsPrice }]}>$6.99</Text>
                  <Text style={[styles.priceUnit, { fontSize: fsPriceUnit }]}>/ month</Text>
                </View>
              )}
            </View>

            {!subscribed && (
              <View style={[styles.features, { gap: featureGap }]}>
                {PREMIUM_FEATURES.map((item) => (
                  <View key={item.label} style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <Ionicons name={item.icon} size={featureIcon} color={colors.accent} />
                    </View>
                    <Text style={[styles.featureText, { fontSize: fsFeature }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {subscribed && (
              <Text style={[styles.subscribedHint, { fontSize: fsFeature }]}>
                Manage your plan in the App Store or Google Play.
              </Text>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingHorizontal: padH, paddingBottom: botPad + edgePad, gap: Math.round(clamp(12 * uiScale, 10, 14)) },
          ]}
        >
          {!rc.isReady || rc.catalogLoading ? (
            <View style={[styles.catalogState, { paddingVertical: btnPadV }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, { fontSize: fsFeature, marginTop: 8 }]}>
                Loading subscription…
              </Text>
            </View>
          ) : !rc.enabled ? (
            <Text style={[styles.loadingText, { fontSize: fsFeature, textAlign: "center" }]}>
              RevenueCat keys are not configured yet.
            </Text>
          ) : !rc.hasMonthlyOffer ? (
            <View style={styles.catalogState}>
              <Text style={[styles.loadingText, { fontSize: fsFeature, textAlign: "center" }]}>
                {rc.catalogError ?? "Monthly subscription is not available yet."}
              </Text>
              <Pressable
                onPress={() => void rc.refresh()}
                style={[styles.ctaBtn, { paddingVertical: btnPadV, borderRadius: btnRad, marginTop: 12 }]}
                testID="paywall-retry"
              >
                <Text style={[styles.ctaText, { fontSize: fsBtn }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                style={[
                  styles.ctaBtn,
                  { paddingVertical: btnPadV, borderRadius: btnRad },
                  purchasing && styles.ctaBtnDisabled,
                ]}
                onPress={() => void onPurchase()}
                disabled={purchasing}
                testID="subscribe-monthly"
              >
                {purchasing ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={[styles.ctaText, { fontSize: fsBtn }]}>
                    {subscribed ? "Manage subscription" : "Subscribe"}
                  </Text>
                )}
              </Pressable>
              {!subscribed && (
                <Text style={[styles.finePrint, { fontSize: fsFine, lineHeight: Math.round(fsFine * 1.45) }]}>
                  Auto-renews monthly. Cancel anytime.
                </Text>
              )}
            </>
          )}

          <View style={styles.footerLinks}>
            <Pressable
              onPress={() => void onRestore()}
              disabled={restoring || !rc.enabled}
              testID="paywall-restore"
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <Text style={[styles.footerLink, { fontSize: fsLink, opacity: restoring ? 0.5 : 1 }]}>
                {restoring ? "Restoring…" : "Restore"}
              </Text>
            </Pressable>
            <Text style={styles.footerDot}>·</Text>
            <Pressable onPress={() => void openLegalDocument(TERMS_URL)} hitSlop={8} accessibilityRole="link">
              <Text style={[styles.footerLink, { fontSize: fsLink }]}>Terms</Text>
            </Pressable>
            <Text style={styles.footerDot}>·</Text>
            <Pressable onPress={() => void openLegalDocument(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
              <Text style={[styles.footerLink, { fontSize: fsLink }]}>Privacy</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void leavePaywall()}
            testID="paywall-sign-out"
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.footerMuted, { fontSize: fsLink }]}>Sign Out</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexShrink: 0,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    paddingVertical: 4,
  },
  closeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    paddingVertical: 8,
  },
  emblem: {
    backgroundColor: "rgba(212,160,67,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,160,67,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  price: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
  },
  priceUnit: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(255,255,255,0.65)",
  },
  features: {
    width: "100%",
    maxWidth: 320,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(255,255,255,0.88)",
  },
  subscribedHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    maxWidth: 280,
  },
  footer: {
    flexShrink: 0,
    alignItems: "center",
  },
  catalogState: {
    width: "100%",
    alignItems: "center",
  },
  ctaBtn: {
    width: "100%",
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  ctaBtnDisabled: {
    opacity: 0.75,
  },
  ctaText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  finePrint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
  loadingText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  footerLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(255,255,255,0.55)",
  },
  footerDot: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
  },
  footerMuted: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(255,255,255,0.38)",
  },
});
