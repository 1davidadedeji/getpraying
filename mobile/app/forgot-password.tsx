import { Feather, Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
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
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { apiUrl } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const padH = Math.round(clamp(24 * uiScale, 20, 30));
  const gap = Math.round(clamp(16 * uiScale, 14, 18));
  const backMb = Math.round(clamp(8 * uiScale, 6, 10));
  const headerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const headerMb = Math.round(clamp(8 * uiScale, 6, 10));
  const mailIcn = Math.round(clamp(40 * uiScale, 34, 46));
  const backIcn = Math.round(clamp(22 * uiScale, 20, 26));
  const fsTitle = Math.round(clamp(24 * uiScale, 21, 28));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 1.4);
  const fsInput = Math.round(clamp(16 * uiScale, 15, 18));
  const padInputH = Math.round(clamp(18 * uiScale, 16, 22));
  const padInputV = Math.round(clamp(14 * uiScale, 12, 16));
  const rInput = Math.round(clamp(32 * uiScale, 26, 36));
  const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const rBtn = Math.round(clamp(32 * uiScale, 26, 36));
  const fsBtn = Math.round(clamp(16 * uiScale, 15, 18));
  const btnMt = Math.round(clamp(8 * uiScale, 6, 10));
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const onSubmit = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {
      showAppAlert({ title: "Email required", message: "Enter the email you used to sign up." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      await res.json().catch(() => ({}));
      router.push(`/reset-password?email=${encodeURIComponent(e)}` as Href);
    } catch {
      showAppAlert({
        title: "Request failed",
        message: "Check your connection and try again.",
      });
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
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { marginBottom: backMb }]}>
          <Feather name="arrow-left" size={backIcn} color={colors.primary} />
        </Pressable>

        <View style={[styles.header, { gap: headerGap, marginBottom: headerMb }]}>
          <Ionicons name="mail-outline" size={mailIcn} color={colors.accent} />
          <Text style={[styles.title, { fontSize: fsTitle }]}>Forgot password</Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            We'll send a 6-digit code to your email to reset your password.
          </Text>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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

        <Pressable
          style={[
            styles.primaryBtn,
            { paddingVertical: btnPadV, borderRadius: rBtn, marginTop: btnMt },
            loading && styles.btnDisabled,
          ]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={[styles.primaryBtnText, { fontSize: fsBtn }]}>Send reset code</Text>
          )}
        </Pressable>
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
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
});
