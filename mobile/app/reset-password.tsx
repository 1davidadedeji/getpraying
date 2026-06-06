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
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { apiFetch } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";
import { goBackOrFallback } from "@/lib/goBackOrFallback";

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
    if (!e || code.length !== 6) {
      showAppAlert({
        title: "Check fields",
        message: "Enter your email and the 6-digit code from your email.",
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
            paddingTop: topPad + 16,
            paddingBottom: botPad + 24,
            paddingHorizontal: padH,
            gap,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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

            <OtpBoxInput
              value={otp}
              onChange={setOtp}
              onComplete={() => {}}
            />

            <Pressable
              style={[
                styles.primaryBtn,
                { paddingVertical: btnPadV, borderRadius: rBtn, marginTop: btnMt },
                (loading || otp.length !== 6) && styles.btnDisabled,
              ]}
              onPress={onVerifyOtp}
              disabled={loading || otp.length !== 6}
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
