import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { getApiBaseUrl } from "@/lib/apiBase";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (typeof params.email === "string") setEmail(decodeURIComponent(params.email));
    if (typeof params.token === "string") setToken(params.token);
  }, [params.email, params.token]);

  const onSubmit = async () => {
    const e = email.trim().toLowerCase();
    const t = token.trim();
    if (!e || !t || password.length < 6) {
      showAppAlert({
        title: "Check fields",
        message: "Enter your email, reset token from the email, and a new password (6+ characters).",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, token: t, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({
          title: "Could not reset",
          message: data?.error ?? "Invalid or expired link. Request a new reset email.",
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
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>
            Paste the token from your reset email. If you opened the link on your phone, fields may
            fill automatically.
          </Text>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="Reset token"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password (6+ characters)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
        />

        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryBtnText}>Update password</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: { paddingHorizontal: 24, gap: 12 },
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
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
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
});
