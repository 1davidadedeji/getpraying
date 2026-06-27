import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVerifyEmail, useResendVerification } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import { AppLogo } from "@/components/AppLogo";
import { DismissKeyboardView } from "@/components/DismissKeyboardView";
import { OtpBoxInput, OTP_LENGTH } from "@/components/OtpBoxInput";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useRevenueCat } from "@/context/revenuecat";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { navigatePostAuth } from "@/lib/postAuthNavigator";
import { resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import {
  loadResendCooldown,
  remainingCooldownSecs,
  resendCooldownSecsForCount,
  saveResendCooldown,
} from "@/lib/resendCooldown";
import { logoutThenClearQueryCache } from "@/lib/safeLogout";
import { clamp } from "@/lib/responsiveMetrics";

function formatCooldown(secs: number): string {
  if (secs >= 60) return `${Math.ceil(secs / 60)}m`;
  return `${secs}s`;
}

export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const padH = Math.round(clamp(22 * uiScale, gutter, 28));
  const containerGap = Math.round(clamp(18 * uiScale, 14, 22));
  const headerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const headerPadH = Math.round(clamp(12 * uiScale, 8, 14));
  const fsTitle = Math.round(clamp(26 * uiScale, 22, 30));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 1.4);
  const cardPad = Math.round(clamp(18 * uiScale, 16, 22));
  const cardRad = Math.round(clamp(cardRadius, 26, 40));
  const cardGap = Math.round(clamp(16 * uiScale, 14, 18));
  const shadowR = Math.round(clamp(20 * uiScale, 16, 24));
  const shadowOff = Math.round(clamp(8 * uiScale, 6, 10));
  const fsLabel = Math.round(clamp(12 * uiScale, 11, 14));
  const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const rBtn = Math.round(clamp(32 * uiScale, 26, 36));
  const fsBtn = Math.round(clamp(16 * uiScale, 15, 18));
  const btnMt = Math.round(clamp(2 * uiScale, 2, 4));
  const fsLink = Math.round(clamp(14 * uiScale, 13, 16));
  const linkPadV = Math.round(clamp(8 * uiScale, 6, 10));
  const { user, refreshUser, logout } = useAuth();
  const { pendingDeepLink, consumePendingHref } = usePendingDeepLink();
  const rc = useRevenueCat();
  const queryClient = useQueryClient();
  const [otp, setOtp] = useState("");
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const email = user?.email ?? "";

  const startCountdown = useCallback((secs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (secs <= 0) {
      setCooldown(0);
      return;
    }
    setCooldown(secs);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Resume any persisted cooldown for this email so leaving/returning (or
  // relaunching) the app can't reset the limit. The server is authoritative;
  // the device only reflects the deadline it already enforced.
  useEffect(() => {
    if (!email) return;
    let active = true;
    void loadResendCooldown(email).then((st) => {
      if (!active || !st) return;
      setResendCount(st.count);
      const remaining = remainingCooldownSecs(st.nextAllowedAt, Date.now());
      if (remaining > 0) startCountdown(remaining);
    });
    return () => {
      active = false;
    };
  }, [email, startCountdown]);

  const onVerify = () => {
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== OTP_LENGTH) {
      showAppAlert({
        title: "Invalid code",
        message: `Please enter the ${OTP_LENGTH}-digit code from your email.`,
      });
      return;
    }
    if (!email) {
      showAppAlert({
        title: "Session needed",
        message: "Please sign in again to verify your email.",
        buttons: [{ text: "OK", onPress: () => router.replace("/login") }],
      });
      return;
    }

    verify.mutate(
      { data: { email, otp: code } },
      {
        onSuccess: () => {
          const next = user ? { ...user, isEmailVerified: true } : null;
          if (next) refreshUser(next);
          if (next) {
            const route = resolvePostAuthNavigation(next, rc, pendingDeepLink, consumePendingHref);
            if (route) navigatePostAuth(route);
          } else {
            router.replace("/login" as Href);
          }
        },
        onError: (err: any) => {
          showAppAlert({
            title: "Verification failed",
            message: err?.data?.error ?? err?.message ?? "That code did not match. Try again or request a new code.",
          });
        },
      },
    );
  };

  const onResend = () => {
    if (cooldown > 0) return;
    if (!email) {
      showAppAlert({
        title: "Session needed",
        message: "Please sign in again.",
        buttons: [{ text: "OK", onPress: () => router.replace("/login") }],
      });
      return;
    }
    resend.mutate(
      { data: { email } },
      {
        onSuccess: () => {
          const newCount = resendCount + 1;
          setResendCount(newCount);
          const secs = resendCooldownSecsForCount(newCount);
          startCountdown(secs);
          void saveResendCooldown(email, {
            count: newCount,
            nextAllowedAt: Date.now() + secs * 1000,
          });
          showAppAlert({
            title: "Code sent",
            message: "Check your inbox for a new verification code.",
          });
        },
        onError: (err: any) => {
          // Server is authoritative: if it reports a wait, reflect/persist it so
          // the countdown stays in sync even after navigating away.
          const waitSecs = typeof err?.data?.waitSecs === "number" ? err.data.waitSecs : 0;
          if (waitSecs > 0) {
            startCountdown(waitSecs);
            void saveResendCooldown(email, {
              count: resendCount,
              nextAllowedAt: Date.now() + waitSecs * 1000,
            });
          }
          showAppAlert({
            title: "Could not resend",
            message: err?.data?.error ?? err?.message ?? "Please try again in a moment.",
          });
        },
      },
    );
  };

  const resendDisabled = resend.isPending || cooldown > 0;

  // Escape hatch: signing in routes an unverified user straight back here, with
  // no other way off the screen. Without this, a typo in the email traps the
  // account until the app is deleted. Sign out + clear caches, then go to the
  // welcome screen so the user can sign in or register with the right email.
  const handleStartOver = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    const proceed = async () => {
      await logoutThenClearQueryCache(logout, queryClient);
      router.replace("/" as Href);
    };
    void proceed();
  }, [logout, queryClient]);

  const confirmStartOver = useCallback(() => {
    showAppAlert({
      title: "Use a different email?",
      message:
        "We'll sign you out so you can sign in or create an account with the correct email.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: handleStartOver },
      ],
    });
  }, [handleStartOver]);

  return (
    <DismissKeyboardView style={[styles.flex, { paddingTop: topPad + 16, paddingBottom: botPad + 24 }]}>
      <View style={[styles.backRow, { top: topPad + 4, left: padH }]}>
        <Pressable
          onPress={confirmStartOver}
          disabled={leaving}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back and use a different email"
          testID="verify-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[styles.backText, { fontSize: fsLink }]}>Back</Text>
        </Pressable>
      </View>

      <View style={[styles.container, { paddingHorizontal: padH, gap: containerGap }]}>
        <View style={[styles.header, { gap: headerGap, paddingHorizontal: headerPadH }]}>
          <AppLogo />
          <Text style={[styles.title, { fontSize: fsTitle }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            Enter the 6-digit code we sent to{" "}
            <Text style={styles.email}>{email || "your inbox"}</Text>.
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
          <Text style={[styles.label, { fontSize: fsLabel }]}>Verification code</Text>

          <OtpBoxInput value={otp} onChange={setOtp} autoFocus />

          <Pressable
            style={[
              styles.primaryBtn,
              {
                paddingVertical: btnPadV,
                borderRadius: rBtn,
                marginTop: btnMt,
              },
              (verify.isPending || otp.length !== OTP_LENGTH) && styles.btnDisabled,
            ]}
            onPress={onVerify}
            disabled={verify.isPending || otp.length !== OTP_LENGTH}
            testID="verify-btn"
          >
            {verify.isPending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={[styles.primaryBtnText, { fontSize: fsBtn }]}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={onResend} disabled={resendDisabled} testID="resend-btn">
            <Text
              style={[
                styles.linkText,
                { fontSize: fsLink, paddingVertical: linkPadV },
                resendDisabled && styles.linkTextDisabled,
              ]}
            >
              {resend.isPending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${formatCooldown(cooldown)}`
                  : "Resend code"}
            </Text>
          </Pressable>
        </View>
      </View>
    </DismissKeyboardView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  email: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
    textAlign: "center",
  },
  linkTextDisabled: {
    color: colors.muted,
  },
  backRow: {
    position: "absolute",
    zIndex: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
});
