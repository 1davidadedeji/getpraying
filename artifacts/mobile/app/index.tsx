import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (!user.onboardingComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [loading, user]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient
      colors={[colors.primary, "#2D3561", colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.inner, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <Ionicons name="flame" size={48} color={colors.accent} />
          </View>
          <Text style={styles.appName}>GetPraying</Text>
          <Text style={styles.tagline}>A sanctuary for your{"\n"}daily walk with God</Text>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Today's Word</Text>
          <Text style={styles.quoteText}>
            "Be still, and know that I am God."
          </Text>
          <Text style={styles.quoteRef}>— Psalm 46:10</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/register")}
            testID="start-journey-btn"
          >
            <Text style={styles.primaryBtnText}>Start Your Journey</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push("/login")}
            testID="sign-in-btn"
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    gap: 12,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(212,160,67,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,160,67,0.1)",
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    color: colors.surface,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 24,
  },
  quoteCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  quoteLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  quoteText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.surface,
    lineHeight: 28,
  },
  quoteRef: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.surface,
  },
});
