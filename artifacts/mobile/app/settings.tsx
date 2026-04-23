import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useModerationBadge } from "@/context/moderationBadge";
import { apiUrl, authHeaders } from "@/lib/api";
import { logoutThenClearQueryCache } from "@/lib/safeLogout";

const TERMS_URL = "https://getpraying.app/tos";
const PRIVACY_URL = "https://getpraying.app/privacy";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, token } = useAuth();
  const { pendingCount: modPending } = useModerationBadge();
  const queryClient = useQueryClient();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleDeleteAccount = () => {
    showAppAlert({
      title: "Delete account?",
      message:
        "This permanently removes your profile, prayers, and saved items. This cannot be undone.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setDeletingAccount(true);
            try {
              const res = await fetch(apiUrl("/auth/account"), {
                method: "DELETE",
                headers: authHeaders(token),
              });
              if (res.ok) {
                await logoutThenClearQueryCache(logout, queryClient);
              } else {
                const err = await res.json().catch(() => ({}));
                showAppAlert({
                  title: "Could not delete account",
                  message: (err as { error?: string }).error ?? "Please try again.",
                });
              }
            } catch {
              showAppAlert({ title: "Could not delete account", message: "Check your connection." });
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    });
  };

  const handleLogout = () => {
    showAppAlert({
      title: "Sign out",
      message: "You'll need to sign in again to view your feed.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await logoutThenClearQueryCache(logout, queryClient);
            router.replace("/");
          },
        },
      ],
    });
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: botPad + 32, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Settings</Text>
      <Text style={styles.screenSub}>Account and prayer preferences</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={() => router.push("/onboarding")}>
            <Feather name="heart" size={18} color={colors.primary} />
            <Text style={styles.menuItemText}>Prayer preferences</Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {(user.role === "admin" || user.role === "moderator") && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team</Text>
          <View style={styles.menuCard}>
            <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={() => router.push("/admin")}>
              <View style={styles.teamRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                {modPending > 0 && (
                  <View style={styles.settingsModPill}>
                    <Text style={styles.settingsModPillText}>
                      {modPending > 99 ? "99+" : String(modPending)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.menuItemText, { color: colors.accent }]}>
                {user.role === "admin" ? "Admin panel" : "Moderation"}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <Pressable
            style={styles.menuItem}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>
              {deletingAccount ? "Deleting…" : "Delete account"}
            </Text>
          </Pressable>
          <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.legalRow}>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={styles.legalLink}>Terms</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.legalLink}>Privacy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  screenTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 26,
    color: colors.primary,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
  },
  section: { gap: 10, marginBottom: 22 },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingsModPill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsModPillText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.surface,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  legalLink: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.accent,
  },
  legalDot: { color: colors.muted, fontSize: 13 },
});
