import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { getApiErrorMessage } from "@/lib/apiErrors";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const usernameRef = useRef<TextInput | null>(null);
  const displayNameRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password) {
      showAppAlert({ title: "Missing fields", message: "Email, username, and password are required." });
      return;
    }
    if (username.trim().length < 3) {
      showAppAlert({ title: "Invalid username", message: "Username must be at least 3 characters." });
      return;
    }
    if (password.length < 6) {
      showAppAlert({ title: "Weak password", message: "Password must be at least 6 characters." });
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), username.trim(), password, displayName.trim() || undefined);
      router.replace("/onboarding");
    } catch (err: unknown) {
      showAppAlert({ title: "Sign up failed", message: getApiErrorMessage(err, "Registration failed") });
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
          { paddingTop: topPad + 16, paddingBottom: botPad + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.primary} />
        </Pressable>

        <View style={styles.header}>
          <Ionicons name="flame" size={36} color={colors.accent} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join our prayer community</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => usernameRef.current?.focus()}
              testID="email-input"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              ref={usernameRef}
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="prayerwarrior"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => displayNameRef.current?.focus()}
              testID="username-input"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Display Name (optional)</Text>
            <TextInput
              ref={displayNameRef}
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How should we call you?"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="displayname-input"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            testID="register-btn"
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.submitBtnText}>Join Get Praying</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
    marginTop: 8,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 28,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.muted,
  },
  form: {
    gap: 14,
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
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
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
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  footerText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
  footerLink: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.accent,
  },
});
