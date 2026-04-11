import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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

export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [otp, setOtp] = useState("");
  const verify = useVerifyEmail();
  const resend = useResendVerification();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const email = user?.email ?? "";

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
          if (user) refreshUser({ ...user, isEmailVerified: true });
          router.replace("/(tabs)");
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
        onSuccess: () =>
          showAppAlert({
            title: "Code sent",
            message: "Check your inbox for a new verification code.",
          }),
        onError: (err: any) =>
          showAppAlert({
            title: "Could not resend",
            message: err?.data?.error ?? err?.message ?? "Please try again in a moment.",
          }),
      },
    );
  };

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

          <Pressable onPress={onResend} disabled={resend.isPending} testID="resend-btn">
            <Text style={styles.linkText}>{resend.isPending ? "Sending…" : "Resend code"}</Text>
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
});
