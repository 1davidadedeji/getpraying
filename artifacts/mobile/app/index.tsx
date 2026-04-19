import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import { getGetDailyWordQueryKey, useGetDailyWord } from "@workspace/api-client-react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { formatLocalYMD } from "@/lib/date";

const TERMS_URL = "https://getpraying.app/terms";
const PRIVACY_URL = "https://getpraying.app/privacy";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const rc = useRevenueCat();
  /** Avoid re-running `router.replace("/(tabs)")` on every `user` object refresh (that was resetting navigation to Home). */
  const didRouteAuthedUser = useRef(false);
  const todayYmd = useMemo(() => formatLocalYMD(new Date()), []);
  const { data: dailyWord } = useGetDailyWord(
    { date: todayYmd },
    {
      query: {
        queryKey: getGetDailyWordQueryKey({ date: todayYmd }),
        retry: 1,
      },
    },
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      didRouteAuthedUser.current = false;
      return;
    }
    if (didRouteAuthedUser.current) return;
    didRouteAuthedUser.current = true;

    // b) Email verification gate
    if (!user.isEmailVerified) {
      router.replace("/(auth)/verify" as Href);
      return;
    }

    // d) moderator/admin always bypass paywall
    if (user.role === "admin" || user.role === "moderator") {
      if (!user.onboardingComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
      return;
    }

    const startedAt = user.trialStartsAt ? new Date(user.trialStartsAt as any) : null;
    const trialExpired =
      startedAt != null && Date.now() - startedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
    if (trialExpired && rc.isReady && rc.enabled && !rc.isEntitled) {
      router.replace("/(paywall)" as any);
      return;
    }

    if (!user.onboardingComplete) {
      router.replace("/onboarding");
    } else {
      router.replace("/(tabs)");
    }
  }, [loading, user, rc.isReady, rc.enabled, rc.isEntitled]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient
      colors={[colors.primary, "#2D3561", colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.inner, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <Ionicons name="flame" size={48} color={colors.accent} />
          </View>
          <Text style={styles.appName}>GetPraying</Text>
          <Text style={styles.tagline}>A sanctuary for your{"\n"}daily walk with God</Text>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Daily Word</Text>
          <Text style={styles.quoteText}>
            &ldquo;{dailyWord?.quoteText ?? "Be still, and know that I am God."}&rdquo;
          </Text>
          <Text style={styles.quoteRef}>
            {dailyWord?.reference ?? "— Psalm 46:10"}
          </Text>
          <View style={styles.socialProofRow}>
            <Ionicons name="flame" size={16} color={colors.accent} />
            <Text style={styles.socialProof}>
              {typeof dailyWord?.prayingWithYou === "number" && dailyWord.prayingWithYou > 0
                ? `${dailyWord.prayingWithYou.toLocaleString()} praying with you`
                : "Praying together, today"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/register")}
            testID="start-journey-btn"
          >
            <Text style={styles.primaryBtnText}>Start Your Journey</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push("/login")}
            testID="sign-in-btn"
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </Pressable>
          <View style={styles.legalRow}>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)}>
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    gap: 12,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(212,160,67,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,160,67,0.1)",
  },
  appName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 38,
    color: colors.surface,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 24,
  },
  quoteCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  quoteLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  quoteText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.surface,
    lineHeight: 28,
  },
  quoteRef: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
  },
  socialProofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  socialProof: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    flex: 1,
  },
  actions: {
    gap: 12,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  legalLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  legalDot: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  secondaryBtn: {
    borderRadius: 32,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
});
