import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { showAppAlert } from "@/components/AppAlert";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { goBackOrFallback } from "@/lib/goBackOrFallback";
import { resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import { formatMonthlyTrialOffer } from "@/lib/revenuecatEntitlements";
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
  const isSoftPaywall = soft === "1" || soft === "true";
  const isCheckingSubscription = rc.isCheckingSubscription;
  const isMandatoryGate =
    !isCheckingSubscription && rc.enabled && !rc.isEntitled && !isSoftPaywall;
  const entitlementRedirected = useRef(false);
  const userRef = useRef(user);
  const rcRef = useRef(rc);
  const pendingDeepLinkRef = useRef(pendingDeepLink);
  const consumePendingHrefRef = useRef(consumePendingHref);

  userRef.current = user;
  rcRef.current = rc;
  pendingDeepLinkRef.current = pendingDeepLink;
  consumePendingHrefRef.current = consumePendingHref;

  const navigateAfterEntitlement = useCallback((forceEntitled = false) => {
    if (entitlementRedirected.current) return;
    entitlementRedirected.current = true;

    const u = userRef.current;
    const rcState = rcRef.current;
    const pending = pendingDeepLinkRef.current;
    const consume = consumePendingHrefRef.current;
    const gate = forceEntitled
      ? { ...rcState, isEntitled: true, isCheckingSubscription: false }
      : rcState;

    if (!u) {
      router.replace("/(tabs)" as Href);
      return;
    }
    router.replace(resolvePostAuthNavigation(u, gate, pending, consume) as Href);
  }, []);

  const leavePaywall = useCallback(async () => {
    await logoutThenClearQueryCache(logout, queryClient);
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }, [logout, queryClient]);

  const dismissPaywall = useCallback(() => {
    if (isMandatoryGate) {
      void leavePaywall();
      return;
    }
    goBackOrFallback("/(tabs)" as Href);
  }, [isMandatoryGate, leavePaywall]);

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

    navigateAfterEntitlement();
  }, [
    isCheckingSubscription,
    user,
    rc.enabled,
    rc.isEntitled,
    rc.isReady,
    navigateAfterEntitlement,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!rc.enabled || rc.hasMonthlyOffer) return;
      void rc.refresh();
    }, [rc.enabled, rc.hasMonthlyOffer, rc.refresh]),
  );

  const onPurchase = async () => {
    if (!rc.hasMonthlyOffer) return;
    try {
      await rc.purchaseMonthly();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateAfterEntitlement(true);
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err?.userCancelled) return;
      const msg = err?.message ?? "Purchase cancelled or failed.";
      showAppAlert({ title: "Subscription not started", message: msg });
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

  const monthlyProduct = rc.monthlyProduct;
  const trialOffer = formatMonthlyTrialOffer(monthlyProduct);
  const legalText =
    Platform.OS === "ios"
      ? "Experience prayer, guidance, and support from faith leaders. Then continue with a membership that gives back to the community."
      : "Experience prayer, guidance, and support from faith leaders. Then continue with a membership that gives back to the community.";

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
    <View style={[styles.flex, { paddingTop: topPad + edgePad, paddingBottom: botPad + edgePad }]}>
      <View style={[styles.container, { paddingHorizontal: padH, gap: containerGap }]}>
        {!isMandatoryGate ? (
          <Pressable
            onPress={dismissPaywall}
            style={[styles.closeBtn, { alignSelf: "flex-start" }]}
            testID="paywall-close"
            hitSlop={12}
          >
            <Text style={[styles.closeText, { fontSize: fsLink }]}>← Back</Text>
          </Pressable>
        ) : null}
        <View style={[styles.hero, { gap: heroGap, paddingHorizontal: heroPadH }]}>
          <Text style={[styles.title, { fontSize: fsTitle }]}>
            {isSoftPaywall ? "Subscribe to unlock" : "Start your free trial"}
          </Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            Subscribe to unlock the prayer feed, Library, reminders, and community features.
          </Text>
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
              <Text style={[styles.loadingText, { fontSize: fsLoading }]}>Loading subscription options…</Text>
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
                style={[styles.retryBtn, { paddingVertical: planPadV, paddingHorizontal: planPadH, borderRadius: planRad }]}
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
                ]}
                onPress={onPurchase}
                testID="subscribe-monthly"
              >
                <View style={styles.planCopy}>
                  <Text style={[styles.planName, styles.planNamePrimary, { fontSize: fsPlan }]}>
                    Subscribe
                  </Text>
                  <Text style={[styles.planSub, { fontSize: fsPlanSub }]}>
                    {trialOffer.includes("Free") ? trialOffer : `${trialOffer} · cancel anytime`}
                  </Text>
                </View>
              </Pressable>
              <Text style={[styles.legal, { fontSize: fsLegal, lineHeight: lhLegal }]}>
                {legalText}
              </Text>
            </>
          )}
        </View>

        {isMandatoryGate ? (
          <Pressable
            onPress={() => void leavePaywall()}
            style={[styles.signOutBtn, { paddingVertical: linkPadV }]}
            testID="paywall-sign-out"
          >
            <Text style={[styles.signOutText, { fontSize: fsLink }]}>Sign out</Text>
          </Pressable>
        ) : isSoftPaywall ? (
          <Pressable
            onPress={dismissPaywall}
            style={[styles.signOutBtn, { paddingVertical: linkPadV }]}
            testID="paywall-not-now"
          >
            <Text style={[styles.signOutText, { fontSize: fsLink }]}>Not now</Text>
          </Pressable>
        ) : null}
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
  container: {
    flex: 1,
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
  signOutBtn: {
    alignItems: "center",
  },
  signOutText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "rgba(14,42,58,0.55)",
  },
  closeBtn: {
    marginBottom: 4,
  },
  closeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#21638D",
  },
});
