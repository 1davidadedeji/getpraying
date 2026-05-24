import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";
import { router } from "expo-router";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useRevenueCat } from "@/context/revenuecat";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

function pickPackages(pkgs: PurchasesPackage[]): { monthly?: PurchasesPackage; annual?: PurchasesPackage } {
  const monthly = pkgs.find((p) => p.packageType === "MONTHLY") ?? pkgs[0];
  const annual = pkgs.find((p) => p.packageType === "ANNUAL") ?? pkgs[1];
  return { monthly, annual };
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const rc = useRevenueCat();
  const { consumePendingHref } = usePendingDeepLink();

  const continueAfterSubscribe = () => {
    router.replace((consumePendingHref() ?? "/(tabs)") as import("expo-router").Href);
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
  const pkgGap = Math.round(clamp(12 * uiScale, 10, 14));
  const planPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const planPadH = Math.round(clamp(18 * uiScale, 16, 22));
  const planRad = Math.round(clamp(32 * uiScale, 28, 36));
  const fsPlan = Math.round(clamp(16 * uiScale, 15, 18));
  const restorePadV = Math.round(clamp(10 * uiScale, 8, 12));
  const fsRestore = Math.round(clamp(14 * uiScale, 13, 16));

  const packages = rc.offerings?.current?.availablePackages ?? [];
  const { monthly, annual } = useMemo(() => pickPackages(packages), [packages]);

  const onPurchase = async (pkg?: PurchasesPackage) => {
    if (!pkg) return;
    try {
      await rc.purchasePackage(pkg);
      showAppAlert({
        title: "Subscribed",
        message: "Thank you. Your subscription is now active.",
        buttons: [{ text: "Continue", onPress: continueAfterSubscribe }],
      });
    } catch (e: any) {
      const msg = e?.message ?? "Purchase cancelled or failed.";
      showAppAlert({ title: "Purchase not completed", message: msg });
    }
  };

  const onRestore = async () => {
    try {
      await rc.restore();
      if (rc.isEntitled) {
        showAppAlert({
          title: "Restored",
          message: "Your purchases have been restored.",
          buttons: [{ text: "Continue", onPress: continueAfterSubscribe }],
        });
      } else {
        showAppAlert({ title: "No active subscription", message: "No previous purchases found. Please subscribe to continue." });
      }
    } catch (e: any) {
      showAppAlert({ title: "Restore failed", message: e?.message ?? "Please try again." });
    }
  };

  return (
    <View style={[styles.flex, { paddingTop: topPad + edgePad, paddingBottom: botPad + edgePad }]}>
      <View style={[styles.container, { paddingHorizontal: padH, gap: containerGap }]}>
        <View style={[styles.hero, { gap: heroGap, paddingHorizontal: heroPadH }]}>
          <Text style={[styles.title, { fontSize: fsTitle }]}>Your 7‑day trial has ended</Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            Continue your journey with full access to the home feed, Library, and reminders.
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
          {!rc.isReady ? (
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
          ) : packages.length === 0 ? (
            <View style={[styles.center, { gap: centerGap, paddingVertical: centerPadV }]}>
              <Text style={[styles.loadingText, { fontSize: fsLoading }]}>No packages available.</Text>
            </View>
          ) : (
            <View style={[styles.packages, { gap: pkgGap }]}>
              <Pressable
                style={[
                  styles.planBtn,
                  styles.planBtnSoft,
                  { paddingVertical: planPadV, paddingHorizontal: planPadH, borderRadius: planRad },
                ]}
                onPress={() => onPurchase(monthly)}
                testID="subscribe-monthly"
              >
                <Text style={[styles.planName, { fontSize: fsPlan }]}>Monthly</Text>
                <Text style={[styles.planPrice, { fontSize: fsPlan }]}>{monthly?.product?.priceString}</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.planBtn,
                  styles.planBtnPrimary,
                  { paddingVertical: planPadV, paddingHorizontal: planPadH, borderRadius: planRad },
                ]}
                onPress={() => onPurchase(annual)}
                testID="subscribe-annual"
              >
                <Text style={[styles.planName, styles.planNamePrimary, { fontSize: fsPlan }]}>Annual</Text>
                <Text style={[styles.planPrice, styles.planPricePrimary, { fontSize: fsPlan }]}>
                  {annual?.product?.priceString}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={onRestore} style={[styles.restoreBtn, { paddingVertical: restorePadV }]} testID="restore-btn">
            <Text style={[styles.restoreText, { fontSize: fsRestore }]}>Restore Purchases</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#E3F2FD",
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
  packages: {},
  planBtn: {
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planBtnSoft: {
    backgroundColor: "#F7FBFF",
    borderColor: "rgba(33,99,141,0.16)",
  },
  planBtnPrimary: {
    backgroundColor: "#21638D",
    borderColor: "rgba(33,99,141,0.2)",
  },
  planName: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0E2A3A",
  },
  planNamePrimary: {
    color: "#FFFFFF",
  },
  planPrice: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#21638D",
  },
  planPricePrimary: {
    color: "#FFFFFF",
  },
  restoreBtn: {
    alignItems: "center",
  },
  restoreText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#21638D",
  },
});

