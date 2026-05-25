import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import { getGetDailyWordQueryKey, useGetDailyWord } from "@workspace/api-client-react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { SplashBrandedFill } from "@/components/AppLoadingScreen";
import { useAuth } from "@/context/auth";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useRevenueCat } from "@/context/revenuecat";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatLocalYMD } from "@/lib/date";
import { getPostAuthRoute, resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import {
  DEFAULT_DAILY_QUOTE,
  DEFAULT_DAILY_REFERENCE,
  PRIVACY_URL,
  TERMS_URL,
  WELCOME_TAGLINE,
} from "@/lib/legalUrls";
import { APP_LOGO_SOURCE, welcomeLogoSizePx } from "@/constants/branding";
import { clamp } from "@/lib/responsiveMetrics";

const WELCOME_PAD_H = 24;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const { user, loading } = useAuth();
  const logoImg = welcomeLogoSizePx(uiScale);
  const fsTitle = Math.round(clamp(34 * uiScale, 30, 40));
  const fsTagline = Math.round(clamp(12 * uiScale, 11, 13));
  const rc = useRevenueCat();
  const { pendingDeepLink, consumePendingHref } = usePendingDeepLink();
  /** Skip duplicate replaces; re-route when the resolved destination changes (e.g. RC ready → paywall). */
  const lastRoutedRef = useRef<string | null>(null);

  const postAuthRoute = useMemo(() => {
    if (loading || !user) return null;
    return String(getPostAuthRoute(user, rc, pendingDeepLink));
  }, [loading, user, rc.isReady, rc.enabled, rc.isEntitled, pendingDeepLink]);

  const todayYmd = useMemo(() => formatLocalYMD(new Date()), []);
  const { data: dailyWord } = useGetDailyWord(
    { date: todayYmd },
    {
      query: {
        queryKey: getGetDailyWordQueryKey({ date: todayYmd }),
        retry: 1,
        enabled: !loading && !user,
      },
    },
  );

  useEffect(() => {
    if (!postAuthRoute || !user) {
      lastRoutedRef.current = null;
      return;
    }
    if (lastRoutedRef.current === postAuthRoute) return;
    lastRoutedRef.current = postAuthRoute;
    router.replace(
      resolvePostAuthNavigation(user, rc, pendingDeepLink, consumePendingHref) as import("expo-router").Href,
    );
  }, [postAuthRoute, user, rc, pendingDeepLink, consumePendingHref]);

  if (loading || user) {
    return <SplashBrandedFill />;
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: topPad + 40,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: WELCOME_PAD_H,
            maxWidth: LAYOUT.welcomeMaxWidth,
            width: "100%",
            alignSelf: "center",
          },
        ]}
      >
        <View style={[styles.logoSection, { gap: Math.round(8 * uiScale) }]}>
          <Image
            source={APP_LOGO_SOURCE}
            style={[styles.logoImage, { width: logoImg, height: logoImg }]}
            contentFit="contain"
            accessibilityLabel="Get Praying app logo"
          />
          <Text style={[styles.appName, { fontSize: fsTitle }]}>Get Praying</Text>
          <Text
            style={[styles.tagline, { fontSize: fsTagline }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {WELCOME_TAGLINE}
          </Text>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Daily Word</Text>
          <Text style={styles.quoteText}>
            &ldquo;{dailyWord?.quoteText ?? DEFAULT_DAILY_QUOTE}&rdquo;
          </Text>
          <Text style={styles.quoteRef}>
            {dailyWord?.reference ?? DEFAULT_DAILY_REFERENCE}
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
              <Text style={styles.legalLink}>Terms of Service</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  inner: {
    flex: 1,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
  },
  logoImage: {},
  appName: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  tagline: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
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
    color: colors.text,
    lineHeight: 28,
  },
  quoteRef: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
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
    color: colors.textSecondary,
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
    color: colors.accent,
  },
  legalDot: { color: colors.muted, fontSize: 13 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
  secondaryBtn: {
    borderRadius: 32,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
});
