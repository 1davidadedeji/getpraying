import { router, type Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVerifyEmail, useResendVerification } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import { AppLogo } from "@/components/AppLogo";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useRevenueCat } from "@/context/revenuecat";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { resolvePostAuthNavigation } from "@/lib/navigateAfterAuth";
import { clamp } from "@/lib/responsiveMetrics";

const COOLDOWN_STEPS = [60, 120, 300, 600];
const OTP_LENGTH = 6;

function formatCooldown(secs: number): string {
  if (secs >= 60) return `${Math.ceil(secs / 60)}m`;
  return `${secs}s`;
}

function OtpBoxInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
}) {
  const { uiScale } = useResponsiveLayout();
  const boxW = Math.round(clamp(48 * uiScale, 40, 54));
  const boxH = Math.round(clamp(56 * uiScale, 48, 62));
  const boxRad = Math.round(clamp(16 * uiScale, 14, 18));
  const boxFs = Math.round(clamp(22 * uiScale, 20, 26));
  const rowGap = Math.round(clamp(8 * uiScale, 6, 10));
  const borderW = Math.max(1, Math.round(2 * uiScale));
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(OTP_LENGTH, "").split("").slice(0, OTP_LENGTH);

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, OTP_LENGTH);
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      refs.current[focusIdx]?.focus();
      if (pasted.length === OTP_LENGTH) onComplete?.();
      return;
    }
    const arr = digits.slice();
    arr[index] = cleaned;
    const newVal = arr.join("").replace(/\s/g, "");
    onChange(newVal);
    if (cleaned && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
    if (newVal.length === OTP_LENGTH) onComplete?.();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
      const arr = digits.slice();
      arr[index - 1] = "";
      onChange(arr.join("").replace(/\s/g, ""));
    }
  };

  return (
    <View style={[otpStyles.row, { gap: rowGap }]}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          style={[
            otpStyles.box,
            {
              width: boxW,
              height: boxH,
              borderRadius: boxRad,
              fontSize: boxFs,
              borderWidth: borderW,
            },
            digits[i]?.trim() ? otpStyles.boxFilled : null,
          ]}
          value={digits[i]?.trim() ?? ""}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          selectTextOnFocus
          testID={`otp-box-${i}`}
        />
      ))}
    </View>
  );
}

const otpStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  box: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.text,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.cream,
  },
});

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
  const { user, refreshUser } = useAuth();
  const { pendingDeepLink, consumePendingHref } = usePendingDeepLink();
  const rc = useRevenueCat();
  const [otp, setOtp] = useState("");
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const email = user?.email ?? "";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = (count: number) => {
    const idx = Math.min(count, COOLDOWN_STEPS.length - 1);
    const secs = COOLDOWN_STEPS[idx] ?? 600;
    setCooldown(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onVerify = () => {
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      showAppAlert({
        title: "Invalid code",
        message: "Please enter the 6-digit code from your email.",
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
            router.replace(resolvePostAuthNavigation(next, rc, pendingDeepLink, consumePendingHref));
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
          startCooldown(newCount);
          showAppAlert({
            title: "Code sent",
            message: "Check your inbox for a new verification code.",
          });
        },
        onError: (err: any) =>
          showAppAlert({
            title: "Could not resend",
            message: err?.data?.error ?? err?.message ?? "Please try again in a moment.",
          }),
      },
    );
  };

  const resendDisabled = resend.isPending || cooldown > 0;

  return (
    <View style={[styles.flex, { paddingTop: topPad + 16, paddingBottom: botPad + 24 }]}>
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

          <OtpBoxInput
            value={otp}
            onChange={setOtp}
            onComplete={() => {}}
          />

          <Pressable
            style={[
              styles.primaryBtn,
              {
                paddingVertical: btnPadV,
                borderRadius: rBtn,
                marginTop: btnMt,
              },
              (verify.isPending || otp.length !== 6) && styles.btnDisabled,
            ]}
            onPress={onVerify}
            disabled={verify.isPending || otp.length !== 6}
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
    </View>
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
});
