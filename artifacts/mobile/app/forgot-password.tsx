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
import { apiUrl } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
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
          { paddingTop: topPad + 16, paddingBottom: botPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.primary} />
        </Pressable>

        <View style={styles.header}>
          <Ionicons name="mail-outline" size={40} color={colors.accent} />
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>
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
            <Text style={styles.primaryBtnText}>Send reset code</Text>
          )}
        </Pressable>
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
