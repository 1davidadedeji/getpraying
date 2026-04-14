import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import colors from "@/constants/colors";
import { apiUrl } from "@/lib/api";

const OTP_LENGTH = 6;

function OtpBoxInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
}) {
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
    <View style={otpStyles.row}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          style={[otpStyles.box, digits[i]?.trim() ? otpStyles.boxFilled : null]}
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
    gap: 8,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 22,
    color: colors.text,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.cream,
  },
});

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
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
    if (!e || code.length !== 6) {
      showAppAlert({
        title: "Check fields",
        message: "Enter your email and the 6-digit code from your email.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/verify-reset-otp"), {
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
      const res = await fetch(apiUrl("/auth/reset-password"), {
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
          { paddingTop: topPad + 16, paddingBottom: botPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.primary} />
        </Pressable>

        <View style={styles.header}>
          <Ionicons name="key-outline" size={40} color={colors.accent} />
          <Text style={styles.title}>
            {otpVerified ? "Set new password" : "Enter reset code"}
          </Text>
          <Text style={styles.subtitle}>
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
                style={styles.input}
              />
            )}

            <OtpBoxInput
              value={otp}
              onChange={setOtp}
              onComplete={() => {}}
            />

            <Pressable
              style={[styles.primaryBtn, (loading || otp.length !== 6) && styles.btnDisabled]}
              onPress={onVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>Verify code</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()}>
              <Text style={styles.linkText}>Didn't get a code? Go back to resend</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPass}
                  style={[styles.input, styles.passwordInput]}
                />
                <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPass}
                style={styles.input}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={onResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>Update password</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: { paddingHorizontal: 24, gap: 16 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 8 },
  header: { alignItems: "center", gap: 10, marginBottom: 8 },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: colors.text,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.accent,
    textAlign: "center",
    paddingVertical: 8,
  },
});
