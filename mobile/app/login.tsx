import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import React, { useRef, useState } from "react";
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
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { clamp } from "@/lib/responsiveMetrics";
import { goBackOrFallback } from "@/lib/goBackOrFallback";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const authPadH = Math.round(clamp(24 * uiScale, 20, 30));
  const logoImgSz = Math.round(clamp(140 * uiScale, 116, 158));
  const fsTitle = Math.round(clamp(28 * uiScale, 24, 32));
  const fsSub = Math.round(clamp(15 * uiScale, 14, 17));
  const fsLabel = Math.round(clamp(13 * uiScale, 12, 15));
  const fsInput = Math.round(clamp(15 * uiScale, 14, 17));
  const padInputH = Math.round(clamp(16 * uiScale, 14, 18));
  const padInputV = Math.round(clamp(14 * uiScale, 12, 16));
  const rInput = Math.round(clamp(32 * uiScale, 26, 36));
  const backIcn = Math.round(clamp(22 * uiScale, 20, 26));
  const eyeIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const backBtnSz = Math.round(clamp(40 * uiScale, 36, 46));
  const headerMb = Math.round(clamp(36 * uiScale, 28, 42));
  const formGap = Math.round(clamp(16 * uiScale, 14, 18));
  const fieldGap = Math.round(clamp(6 * uiScale, 5, 8));
  const passPadR = Math.round(clamp(48 * uiScale, 44, 54));
  const eyeRight = Math.round(clamp(14 * uiScale, 12, 16));
  const fsForgot = Math.round(clamp(13 * uiScale, 12, 15));
  const submitPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const rSubmit = Math.round(clamp(32 * uiScale, 26, 36));
  const fsSubmit = Math.round(clamp(16 * uiScale, 15, 18));
  const fsFooter = Math.round(clamp(14 * uiScale, 13, 16));
  const footerMt = Math.round(clamp(28 * uiScale, 22, 32));
  const { login } = useAuth();
  const passwordRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAppAlert({ title: "Missing fields", message: "Enter your email and password." });
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (!u.isEmailVerified) {
        router.replace("/(auth)/verify" as Href);
      } else if (!u.onboardingComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      showAppAlert({ title: "Login failed", message: getApiErrorMessage(err, "Login failed") });
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
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: topPad + 16,
            paddingBottom: botPad + 20,
            paddingHorizontal: authPadH,
            maxWidth: LAYOUT.authMaxWidth,
            width: "100%",
            alignSelf: "center",
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => goBackOrFallback("/(tabs)" as Href)}
          style={[styles.backBtn, { width: backBtnSz, height: backBtnSz, marginBottom: Math.round(8 * uiScale) }]}
        >
          <Feather name="arrow-left" size={backIcn} color={colors.primary} />
        </Pressable>

        <View style={[styles.header, { gap: Math.round(8 * uiScale), marginBottom: headerMb, marginTop: Math.round(8 * uiScale) }]}>
          <Image
            source={require("../assets/images/icon-bg.png")}
            style={[styles.logoImage, { width: logoImgSz, height: logoImgSz }]}
            contentFit="contain"
            accessibilityLabel="Get Praying app logo"
          />
          <Text style={[styles.title, { fontSize: fsTitle }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { fontSize: fsSub }]}>Continue your prayer journey</Text>
        </View>

        <View style={[styles.form, { gap: formGap }]}>
          <View style={[styles.field, { gap: fieldGap }]}>
            <Text style={[styles.label, { fontSize: fsLabel }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                {
                  fontSize: fsInput,
                  paddingHorizontal: padInputH,
                  paddingVertical: padInputV,
                  borderRadius: rInput,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="email-input"
            />
          </View>

          <View style={[styles.field, { gap: fieldGap }]}>
            <Text style={[styles.label, { fontSize: fsLabel }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
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
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPass((s) => !s)} style={[styles.eyeBtn, { right: eyeRight }]}>
                <Feather name={showPass ? "eye-off" : "eye"} size={eyeIcn} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push("/forgot-password" as Href)} style={styles.forgotRow}>
            <Text style={[styles.forgotText, { fontSize: fsForgot }]}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={[
              styles.submitBtn,
              { paddingVertical: submitPadV, borderRadius: rSubmit, marginTop: Math.round(8 * uiScale) },
              loading && styles.submitBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            testID="login-btn"
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.submitBtnText, { fontSize: fsSubmit }]}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.footer, { marginTop: footerMt }]}>
          <Text style={[styles.footerText, { fontSize: fsFooter }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/register")}>
            <Text style={[styles.footerLink, { fontSize: fsFooter }]}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {
    flexGrow: 1,
  },
  backBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
  },
  logoImage: {},
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  form: {},
  field: {},
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
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
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 4,
    paddingVertical: 6,
  },
  forgotText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  footerLink: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
  },
});
