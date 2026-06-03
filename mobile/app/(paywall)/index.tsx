import { useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { goBackOrFallback } from "@/lib/goBackOrFallback";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalUrls";
import { openLegalDocument } from "@/lib/openLegalDocument";
import { resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import {
  consumePendingNotificationHref,
  applyNotificationHref,
} from "@/lib/notificationNavigation";
import { formatMonthlyTrialOffer, hasPremiumEntitlement } from "@/lib/revenuecatEntitlements";
import {
  describeEntitlementAfterPurchase,
  isPurchaseAlreadyOwnedError,
  isPurchaseUserCancelled,
  purchaseErrorMessage,
} from "@/lib/revenuecatPurchase";
import { logoutThenClearQueryCache } from "@/lib/safeLogout";
import { clamp } from "@/lib/responsiveMetrics";

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const { user, logout } = useAuth();
  const rc = useRevenueCat();
  const queryClient = useQueryClient();
  const { pendingDeepLink, consumePendingHref } = usePendingDeepLink();
  const { soft } = useLocalSearchParams<{ soft?: string }>();
  const pathname = usePathname();
  const isSoftPaywall = soft === "1" || soft === "true";
  const entitlementRedirected = useRef(false);
  const signingOut = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
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
  /** Hard gate: user cannot use the app without starting the store subscription. */
  const isMandatoryGate =
    !isCheckingSubscription && rc.enabled && !rc.isEntitled && !isSoftPaywall;

  const enterApp = useCallback(() => {
    if (entitlementRedirected.current) return;
    entitlementRedirected.current = true;

    const u = userRef.current;
    const rcState = rcRef.current;
    const pending = pendingDeepLinkRef.current;
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
    router.replace(route);
  }, []);

  const leavePaywall = useCallback(async () => {
    signingOut.current = true;
    await logoutThenClearQueryCache(logout, queryClient);
  }, [logout, queryClient]);

  /** Back: mandatory gate signs out; soft / entitled users return to the previous screen. */
  const dismissPaywall = useCallback(() => {
    if (isMandatoryGate) {
      void leavePaywall();
      return;
    }
    goBackOrFallback("/(tabs)" as Href);
  }, [isMandatoryGate, leavePaywall]);

  const finishAfterEntitlement = useCallback(
    (opts?: { haptic?: boolean }) => {
      if (opts?.haptic !== false) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (isSoftPaywall) {
        dismissPaywall();
        return;
      }
      enterApp();
    },
    [dismissPaywall, enterApp, isSoftPaywall],
  );

  useEffect(() => {
    if (!signingOut.current || user !== null) return;
    signingOut.current = false;
    router.replace("/");
  }, [user]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissPaywall();
      return true;
    });
    return () => sub.remove();
  }, [dismissPaywall]);

  useEffect(() => {
    if (isSoftPaywall) return;
    if (isCheckingSubscription || entitlementRedirected.current) return;
    if (!user) return;
    if (rc.enabled && !rc.isEntitled) return;
    enterApp();
  }, [
    isSoftPaywall,
    isCheckingSubscription,
    user,
    rc.enabled,
    rc.isEntitled,
    rc.isReady,
    enterApp,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!rc.isEntitled) {
        entitlementRedirected.current = false;
      }
      if (!rc.enabled || rc.hasMonthlyOffer) return;
      void rc.refresh();
    }, [rc.enabled, rc.hasMonthlyOffer, rc.isEntitled, rc.refresh]),
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
            title: "Free trial active",
            message:
              "Your subscription is already active on a free trial. Boost unlocks once your trial converts to a paid plan.",
          });
        }
        return;
      }
      showAppAlert({
        title: "Free trial active",
        message:
          "Your subscription is already active on a free trial. Boost unlocks automatically once your trial converts to a paid plan.",
      });
      return;
    }

    if (rc.canUseBoost || (rc.isEntitled && hasPremiumEntitlement(rc.customerInfo))) {
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
            message:
              "You're on a free trial. Boost unlocks once your trial converts to a paid subscription.",
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const edgePad = Math.round(clamp(18 * uiScale, 14, 22));
  const padH = gutter;
  const containerGap = Math.round(clamp(18 * uiScale, 14, 22));
  const heroGap = Math.round(clamp(10 * uiScale, 8, 12));
  const heroPadH = Math.round(clamp(10 * uiScale, 8, 12));
  const fsTitle = Math.round(clamp(28 * uiScale, 24, 32));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 1.4);
  const cardPad = Math.round(clamp(18 * uiScale, 16, 22));
  const cardRad = Math.round(clamp(cardRadius, 26, 40));
  const cardGap = Math.round(clamp(14 * uiScale, 12, 16));
  const shadowR = Math.round(clamp(20 * uiScale, 16, 24));
  const shadowOff = Math.round(clamp(8 * uiScale, 6, 10));
  const centerGap = Math.round(clamp(8 * uiScale, 6, 10));
  const centerPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const fsLoading = Math.round(clamp(13 * uiScale, 12, 15));
  const planPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const planPadH = Math.round(clamp(18 * uiScale, 16, 22));
  const planRad = Math.round(clamp(32 * uiScale, 28, 36));
  const fsPlan = Math.round(clamp(16 * uiScale, 15, 18));
  const fsPlanSub = Math.round(clamp(13 * uiScale, 12, 15));
  const fsLegal = Math.round(clamp(11 * uiScale, 10, 12));
  const lhLegal = Math.round(fsLegal * 1.45);
  const linkPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const fsLink = Math.round(clamp(14 * uiScale, 13, 16));
  const fsFooter = Math.round(clamp(13 * uiScale, 12, 15));

  const monthlyProduct = rc.monthlyProduct;
  const trialOffer = formatMonthlyTrialOffer(monthlyProduct);
  const legalText =
    "Experience prayer, guidance, and support from faith leaders. Then continue with a membership that gives back to the community.";

  const headline = isSoftPaywall
    ? rc.isPremiumTrial
      ? "Upgrade to unlock Boost"
      : "Subscribe to unlock"
    : "Start your free trial";

  const subtitle = isSoftPaywall
    ? "Boost and other premium perks unlock with a fully paid subscription."
    : "Subscribe to unlock the prayer feed, Library, reminders, and community features.";

  if (isCheckingSubscription) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <View style={[styles.flex, styles.subscriptionGate, { paddingTop: topPad + edgePad }]}>
          <ActivityIndicator color="#21638D" size="large" />
          <Text style={[styles.loadingText, { fontSize: fsLoading, marginTop: centerGap }]}>
            Checking subscription…
          </Text>
        </View>
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
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: topPad, paddingHorizontal: padH }]}>
          <Pressable
            onPress={dismissPaywall}
            style={styles.closeBtn}
            testID="paywall-close"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isMandatoryGate ? "Sign out" : "Go back"}
          >
            <Text style={[styles.closeText, { fontSize: fsLink }]}>← Back</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: padH, paddingBottom: edgePad, gap: containerGap },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { gap: heroGap, paddingHorizontal: heroPadH }]}>
            <Text style={[styles.title, { fontSize: fsTitle }]}>{headline}</Text>
            <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>{subtitle}</Text>
          </View>

          <View
            style={[
              styles.card,
              {
                padding: cardPad,
                borderRadius: cardRad,
                gap: cardGap,
                shadowRadius: shadowR,
                shadowOffset: { width: 0, height: shadowOff },
              },
            ]}
          >
            {!rc.isReady || rc.catalogLoading ? (
              <View style={[styles.center, { gap: centerGap, paddingVertical: centerPadV }]}>
                <ActivityIndicator color="#21638D" />
                <Text style={[styles.loadingText, { fontSize: fsLoading }]}>
                  Loading subscription options…
                </Text>
              </View>
            ) : !rc.enabled ? (
              <View style={[styles.center, { gap: centerGap, paddingVertical: centerPadV }]}>
                <Text style={[styles.loadingText, { fontSize: fsLoading }]}>
                  RevenueCat keys are not configured yet.
                </Text>
              </View>
            ) : !rc.hasMonthlyOffer ? (
              <View style={[styles.center, { gap: centerGap, paddingVertical: centerPadV }]}>
                <Text style={[styles.loadingText, { fontSize: fsLoading }]}>
                  {rc.catalogError ?? "Monthly subscription is not available yet."}
                </Text>
                <Pressable
                  onPress={() => void rc.refresh()}
                  style={[
                    styles.retryBtn,
                    { paddingVertical: planPadV, paddingHorizontal: planPadH, borderRadius: planRad },
                  ]}
                  testID="paywall-retry"
                >
                  <Text style={[styles.retryText, { fontSize: fsPlan }]}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Pressable
                  style={[
                    styles.planBtn,
                    styles.planBtnPrimary,
                    { paddingVertical: planPadV, paddingHorizontal: planPadH, borderRadius: planRad },
                    purchasing && styles.planBtnDisabled,
                  ]}
                  onPress={() => void onPurchase()}
                  disabled={purchasing}
                  testID="subscribe-monthly"
                >
                  {purchasing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.planCopy}>
                      <Text style={[styles.planName, styles.planNamePrimary, { fontSize: fsPlan }]}>
                        {rc.isPremiumTrial ? "Manage subscription" : "Subscribe"}
                      </Text>
                      <Text style={[styles.planSub, { fontSize: fsPlanSub }]}>
                        {rc.isPremiumTrial
                          ? "Free trial active · Boost unlocks after paid conversion"
                          : trialOffer.includes("Free")
                            ? trialOffer
                            : `${trialOffer} · cancel anytime`}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text style={[styles.legal, { fontSize: fsLegal, lineHeight: lhLegal }]}>
                  {legalText}
                </Text>
              </>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingHorizontal: padH, paddingBottom: botPad + edgePad, gap: linkPadV },
          ]}
        >
          <Pressable
            onPress={() => void leavePaywall()}
            style={[styles.footerBtn, { paddingVertical: linkPadV }]}
            testID="paywall-sign-out"
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.footerMuted, { fontSize: fsFooter }]}>Sign Out</Text>
          </Pressable>

          <View style={styles.legalRow}>
            <Pressable
              onPress={() => void openLegalDocument(TERMS_URL)}
              style={[styles.footerBtn, { paddingVertical: linkPadV }]}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={[styles.footerLink, { fontSize: fsFooter }]}>Terms of Service</Text>
            </Pressable>
            <Text style={[styles.legalDot, { fontSize: fsFooter }]}>·</Text>
            <Pressable
              onPress={() => void openLegalDocument(PRIVACY_URL)}
              style={[styles.footerBtn, { paddingVertical: linkPadV }]}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={[styles.footerLink, { fontSize: fsFooter }]}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#E3F2FD",
  },
  subscriptionGate: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexShrink: 0,
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
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: "#0E2A3A",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(14,42,58,0.72)",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.12)",
    shadowColor: "#21638D",
    shadowOpacity: 0.08,
    elevation: 2,
  },
  center: {
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(14,42,58,0.72)",
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#21638D",
    alignItems: "center",
  },
  retryText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  planBtn: {
    borderWidth: 1,
    alignItems: "center",
  },
  planBtnPrimary: {
    backgroundColor: "#21638D",
    borderColor: "rgba(33,99,141,0.2)",
  },
  planBtnDisabled: {
    opacity: 0.7,
  },
  planCopy: {
    alignItems: "center",
    gap: 4,
  },
  planName: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0E2A3A",
    textAlign: "center",
  },
  planNamePrimary: {
    color: "#FFFFFF",
  },
  planSub: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
  },
  legal: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(14,42,58,0.62)",
    textAlign: "center",
  },
  footer: {
    flexShrink: 0,
    alignItems: "center",
  },
  footerBtn: {
    alignItems: "center",
  },
  footerLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#21638D",
  },
  footerMuted: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(14,42,58,0.55)",
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  legalDot: {
    color: "rgba(14,42,58,0.45)",
  },
  closeBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  closeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#21638D",
  },
});
