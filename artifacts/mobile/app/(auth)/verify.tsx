import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVerifyEmail, useResendVerification } from "@workspace/api-client-react";
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
      Alert.alert("Invalid code", "Please enter the 6-digit code.");
      return;
    }
    if (!email) {
      Alert.alert("Missing email", "Please sign in again.");
      router.replace("/login");
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
          Alert.alert("Verification failed", err?.data?.error ?? err?.message ?? "Invalid code");
        },
      },
    );
  };

  const onResend = () => {
    if (!email) {
      Alert.alert("Missing email", "Please sign in again.");
      router.replace("/login");
      return;
    }
    resend.mutate(
      { data: { email } },
      {
        onSuccess: () => Alert.alert("Sent", "A new code has been sent to your email."),
        onError: (err: any) =>
          Alert.alert("Could not resend", err?.data?.error ?? err?.message ?? "Try again"),
      },
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: topPad + 16, paddingBottom: botPad + 24 }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail" size={22} color="#21638D" />
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
              placeholder="123456"
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
            <Text style={styles.linkText}>
              {resend.isPending ? "Resending…" : "Resend code"}
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
    backgroundColor: "#E3F2FD",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 26,
    color: "#0E2A3A",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "rgba(14,42,58,0.72)",
    textAlign: "center",
    lineHeight: 20,
  },
  email: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#21638D",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.12)",
    gap: 12,
    shadowColor: "#21638D",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(14,42,58,0.65)",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  codeInput: {
    flex: 1,
    backgroundColor: "#F7FBFF",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.16)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 18,
    letterSpacing: 6,
    color: "#0E2A3A",
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F7FBFF",
    borderWidth: 1,
    borderColor: "rgba(33,99,141,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#21638D",
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 2,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  linkText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#21638D",
    textAlign: "center",
    paddingVertical: 8,
  },
});

