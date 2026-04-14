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

function pickPackages(pkgs: PurchasesPackage[]): { monthly?: PurchasesPackage; annual?: PurchasesPackage } {
  const monthly = pkgs.find((p) => p.packageType === "MONTHLY") ?? pkgs[0];
  const annual = pkgs.find((p) => p.packageType === "ANNUAL") ?? pkgs[1];
  return { monthly, annual };
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const rc = useRevenueCat();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const packages = rc.offerings?.current?.availablePackages ?? [];
  const { monthly, annual } = useMemo(() => pickPackages(packages), [packages]);

  const onPurchase = async (pkg?: PurchasesPackage) => {
    if (!pkg) return;
    try {
      await rc.purchasePackage(pkg);
      showAppAlert({
        title: "Subscribed",
        message: "Thank you. Your subscription is now active.",
        buttons: [{ text: "Continue", onPress: () => router.replace("/(tabs)") }],
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
          buttons: [{ text: "Continue", onPress: () => router.replace("/(tabs)") }],
        });
      } else {
        showAppAlert({ title: "No active subscription", message: "No previous purchases found. Please subscribe to continue." });
      }
    } catch (e: any) {
      showAppAlert({ title: "Restore failed", message: e?.message ?? "Please try again." });
    }
  };

  return (
    <View style={[styles.flex, { paddingTop: topPad + 18, paddingBottom: botPad + 18 }]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>Your 7‑day trial has ended</Text>
          <Text style={styles.subtitle}>
            Continue your journey with full access to Feeds, Library, and reminders.
          </Text>
        </View>

        <View style={styles.card}>
          {!rc.isReady ? (
            <View style={styles.center}>
              <ActivityIndicator color="#21638D" />
              <Text style={styles.loadingText}>Loading subscription options…</Text>
            </View>
          ) : !rc.enabled ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>
                RevenueCat keys are not configured yet.
              </Text>
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>No packages available.</Text>
            </View>
          ) : (
            <View style={styles.packages}>
              <Pressable
                style={[styles.planBtn, styles.planBtnSoft]}
                onPress={() => onPurchase(monthly)}
                testID="subscribe-monthly"
              >
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>{monthly?.product?.priceString}</Text>
              </Pressable>

              <Pressable
                style={[styles.planBtn, styles.planBtnPrimary]}
                onPress={() => onPurchase(annual)}
                testID="subscribe-annual"
              >
                <Text style={[styles.planName, styles.planNamePrimary]}>Annual</Text>
                <Text style={[styles.planPrice, styles.planPricePrimary]}>
                  {annual?.product?.priceString}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={onRestore} style={styles.restoreBtn} testID="restore-btn">
            <Text style={styles.restoreText}>Restore Purchases</Text>
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
    paddingHorizontal: 22,
    gap: 18,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 28,
    color: "#0E2A3A",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "rgba(14,42,58,0.72)",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.12)",
    gap: 14,
    shadowColor: "#21638D",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  center: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: "rgba(14,42,58,0.72)",
    textAlign: "center",
  },
  packages: {
    gap: 12,
  },
  planBtn: {
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 18,
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
    fontSize: 16,
    color: "#0E2A3A",
  },
  planNamePrimary: {
    color: "#FFFFFF",
  },
  planPrice: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: "#21638D",
  },
  planPricePrimary: {
    color: "#FFFFFF",
  },
  restoreBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  restoreText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#21638D",
  },
});

