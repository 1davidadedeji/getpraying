import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAppAlert } from "@/components/AppAlert";
import { AppLogo } from "@/components/AppLogo";
import { DismissKeyboardView } from "@/components/DismissKeyboardView";
import { OtpBoxInput, OTP_LENGTH } from "@/components/OtpBoxInput";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { apiFetch } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";
import { goBackOrFallback } from "@/lib/goBackOrFallback";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const padH = Math.round(clamp(24 * uiScale, 20, 30));
  const gap = Math.round(clamp(16 * uiScale, 14, 18));
  const backMb = Math.round(clamp(8 * uiScale, 6, 10));
  const headerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const headerMb = Math.round(clamp(8 * uiScale, 6, 10));
  const backIcn = Math.round(clamp(22 * uiScale, 20, 26));
  const fsTitle = Math.round(clamp(24 * uiScale, 21, 28));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 1.4);
  const fsLabel = Math.round(clamp(13 * uiScale, 12, 15));
  const fieldGap = Math.round(clamp(6 * uiScale, 5, 8));
  const fsInput = Math.round(clamp(16 * uiScale, 15, 18));
  const padInputH = Math.round(clamp(18 * uiScale, 16, 22));
  const padInputV = Math.round(clamp(14 * uiScale, 12, 16));
  const rInput = Math.round(clamp(32 * uiScale, 26, 36));
  const passPadR = Math.round(clamp(48 * uiScale, 44, 54));
  const eyeRight = Math.round(clamp(14 * uiScale, 12, 16));
  const eyeIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const rBtn = Math.round(clamp(32 * uiScale, 26, 36));
  const fsBtn = Math.round(clamp(16 * uiScale, 15, 18));
  const btnMt = Math.round(clamp(8 * uiScale, 6, 10));
  const fsLink = Math.round(clamp(14 * uiScale, 13, 16));
  const linkPadV = Math.round(clamp(8 * uiScale, 6, 10));
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (typeof params.email === "string") setEmail(decodeURIComponent(params.email));
  }, [params.email]);

  const onVerifyOtp = async () => {
    const e = email.trim().toLowerCase();
    const code = otp.replace(/\D/g, "");
    if (!e || code.length !== OTP_LENGTH) {
      showAppAlert({
        title: "Check fields",
        message: `Enter your email and the ${OTP_LENGTH}-digit code from your email.`,
      });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, otp: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({
          title: "Verification failed",
          message: data?.error ?? "Invalid or expired code. Try again.",
        });
        return;
      }
      setOtpVerified(true);
      setTimeout(() => passwordRef.current?.focus(), 300);
    } catch {
      showAppAlert({ title: "Error", message: "Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (password.length < 6) {
      showAppAlert({ title: "Weak password", message: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      showAppAlert({ title: "Mismatch", message: "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.replace(/\D/g, ""),
          newPassword: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({
          title: "Could not reset",
          message: data?.error ?? "Please try again.",
        });
        return;
      }
      showAppAlert({
        title: "Password updated",
        message: "You can sign in with your new password.",
        buttons: [{ text: "Sign in", onPress: () => router.replace("/login") }],
      });
    } catch {
      showAppAlert({ title: "Error", message: "Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            flexGrow: 1,
            paddingTop: topPad + 16,
            paddingBottom: botPad + 24,
            paddingHorizontal: padH,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <DismissKeyboardView style={{ flexGrow: 1, gap }}>
        <Pressable onPress={() => goBackOrFallback("/login" as Href)} style={[styles.backBtn, { marginBottom: backMb }]}>
          <Feather name="arrow-left" size={backIcn} color={colors.primary} />
        </Pressable>

        <View style={[styles.header, { gap: headerGap, marginBottom: headerMb }]}>
          <AppLogo />
          <Text style={[styles.title, { fontSize: fsTitle }]}>
            {otpVerified ? "Set new password" : "Enter reset code"}
          </Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            {otpVerified
              ? "Choose a strong new password for your account."
              : `Enter the 6-digit code we sent to ${email || "your email"}.`}
          </Text>
        </View>

        {!otpVerified ? (
          <>
            {!params.email && (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    fontSize: fsInput,
                    paddingHorizontal: padInputH,
                    paddingVertical: padInputV,
                    borderRadius: rInput,
                  },
                ]}
              />
            )}

            <OtpBoxInput value={otp} onChange={setOtp} autoFocus />

            <Pressable
              style={[
                styles.primaryBtn,
                { paddingVertical: btnPadV, borderRadius: rBtn, marginTop: btnMt },
                (loading || otp.length !== OTP_LENGTH) && styles.btnDisabled,
              ]}
              onPress={onVerifyOtp}
              disabled={loading || otp.length !== OTP_LENGTH}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.primaryBtnText, { fontSize: fsBtn }]}>Verify code</Text>
              )}
            </Pressable>

            <Pressable onPress={() => goBackOrFallback("/login" as Href)}>
              <Text style={[styles.linkText, { fontSize: fsLink, paddingVertical: linkPadV }]}>
                Didn't get a code? Go back to resend
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.field, { gap: fieldGap }]}>
              <Text style={[styles.label, { fontSize: fsLabel }]}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPass}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      fontSize: fsInput,
                      paddingHorizontal: padInputH,
                      paddingVertical: padInputV,
                      borderRadius: rInput,
                      paddingRight: passPadR,
                    },
                  ]}
                />
                <Pressable onPress={() => setShowPass((s) => !s)} style={[styles.eyeBtn, { right: eyeRight }]}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={eyeIcn} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.field, { gap: fieldGap }]}>
              <Text style={[styles.label, { fontSize: fsLabel }]}>Confirm Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPass}
                style={[
                  styles.input,
                  {
                    fontSize: fsInput,
                    paddingHorizontal: padInputH,
                    paddingVertical: padInputV,
                    borderRadius: rInput,
                  },
                ]}
              />
            </View>

            <Pressable
              style={[
                styles.primaryBtn,
                { paddingVertical: btnPadV, borderRadius: rBtn, marginTop: btnMt },
                loading && styles.btnDisabled,
              ]}
              onPress={onResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.primaryBtnText, { fontSize: fsBtn }]}>Update password</Text>
              )}
            </Pressable>
          </>
        )}
        </DismissKeyboardView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {},
  backBtn: { alignSelf: "flex-start", padding: 4 },
  header: { alignItems: "center" },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
  field: {},
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {},
  eyeBtn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
    textAlign: "center",
  },
});
