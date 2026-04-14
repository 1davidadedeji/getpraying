import { Feather, Ionicons } from "@expo/vector-icons";
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
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

// Cooldown schedule: 60s, 120s, 300s, 600s, then always 600s
const COOLDOWN_STEPS = [60, 120, 300, 600];

function formatCooldown(secs: number): string {
  if (secs >= 60) return `${Math.ceil(secs / 60)}m`;
  return `${secs}s`;
}

export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
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
          if (next && !next.onboardingComplete) {
            router.replace("/onboarding" as Href);
          } else {
            router.replace("/(tabs)" as Href);
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
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail" size={22} color={colors.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to{" "}
            <Text style={styles.email}>{email || "your inbox"}</Text>.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Verification code</Text>
          <View style={styles.codeRow}>
            <TextInput
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onVerify}
              style={styles.codeInput}
              maxLength={6}
              testID="otp-input"
            />
            <Pressable onPress={() => setOtp("")} style={styles.clearBtn} testID="clear-otp">
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.primaryBtn, (verify.isPending || otp.length !== 6) && styles.btnDisabled]}
            onPress={onVerify}
            disabled={verify.isPending || otp.length !== 6}
            testID="verify-btn"
          >
            {verify.isPending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryBtnText}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={onResend} disabled={resendDisabled} testID="resend-btn">
            <Text style={[styles.linkText, resendDisabled && styles.linkTextDisabled]}>
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
    paddingHorizontal: 22,
    gap: 18,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 26,
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  email: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 18,
    letterSpacing: 6,
    color: colors.text,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 2,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.accent,
    textAlign: "center",
    paddingVertical: 8,
  },
  linkTextDisabled: {
    color: colors.muted,
  },
});
