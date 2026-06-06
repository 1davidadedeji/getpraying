import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { showAppAlert } from "@/components/AppAlert";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { clamp } from "@/lib/responsiveMetrics";
import { useModerationBadge } from "@/context/moderationBadge";
import { apiFetch } from "@/lib/api";
import { registerAndSyncPushToken } from "@/lib/syncExpoPushToken";
import { syncDeviceTimezone } from "@/lib/syncDeviceTimezone";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalUrls";
import { openWebAdmin } from "@/lib/webAdmin";
import { logoutThenClearQueryCache } from "@/lib/safeLogout";

export default function SettingsScreen() {
  useStackHeaderBack("/(tabs)/profile" as Href);
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const sui = useMemo(() => {
    const topExtra = Math.round(clamp(8 * uiScale, 6, 12));
    const botExtra = Math.round(clamp(32 * uiScale, 28, 40));
    const titleFs = Math.round(clamp(26 * uiScale, 22, 30));
    const titleMb = Math.round(clamp(4 * uiScale, 3, 5));
    const subFs = Math.round(clamp(14 * uiScale, 13, 16));
    const subMb = Math.round(clamp(24 * uiScale, 20, 28));
    const sectionMb = Math.round(clamp(22 * uiScale, 18, 26));
    const sectionGap = Math.round(clamp(10 * uiScale, 8, 12));
    const sectionTitleFs = Math.round(clamp(13 * uiScale, 12, 14));
    const sectionLs = clamp(0.8 * uiScale, 0.5, 1.1);
    const cardRad = Math.round(clamp(32 * uiScale, 28, 40));
    const cardBorderW = Math.max(1, Math.round(uiScale));
    const menuPadH = Math.round(clamp(16 * uiScale, 14, 20));
    const menuPadV = Math.round(clamp(14 * uiScale, 12, 16));
    const menuGap = Math.round(clamp(12 * uiScale, 10, 14));
    const menuIcon = Math.round(clamp(18 * uiScale, 16, 20));
    const chevIcon = Math.round(clamp(16 * uiScale, 14, 18));
    const menuTextFs = Math.round(clamp(15 * uiScale, 14, 16));
    const teamGap = Math.round(clamp(6 * uiScale, 5, 8));
    const modPillMinW = Math.round(clamp(18 * uiScale, 16, 22));
    const modPillH = Math.round(clamp(18 * uiScale, 16, 22));
    const modPillPadH = Math.round(clamp(5 * uiScale, 4, 6));
    const modPillRad = Math.round(clamp(9 * uiScale, 8, 11));
    const modPillFs = Math.round(clamp(10 * uiScale, 9, 11));
    const legalGap = Math.round(clamp(10 * uiScale, 8, 12));
    const legalFs = Math.round(clamp(13 * uiScale, 12, 14));
    const legalMt = Math.round(clamp(8 * uiScale, 6, 10));
    return {
      topExtra,
      botExtra,
      titleFs,
      titleMb,
      subFs,
      subMb,
      sectionMb,
      sectionGap,
      sectionTitleFs,
      sectionLs,
      cardRad,
      cardBorderW,
      menuPadH,
      menuPadV,
      menuGap,
      menuIcon,
      chevIcon,
      menuTextFs,
      teamGap,
      modPillMinW,
      modPillH,
      modPillPadH,
      modPillRad,
      modPillFs,
      legalGap,
      legalFs,
      legalMt,
    };
  }, [uiScale]);
  const { user, logout, token } = useAuth();
  const { pendingCount: modPending } = useModerationBadge();
  const queryClient = useQueryClient();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [scheduledNotifsEnabled, setScheduledNotifsEnabled] = useState(
    () => (user as any)?.scheduledNotificationsEnabled ?? true,
  );
  const [savingNotifPref, setSavingNotifPref] = useState(false);

  const handleNotifToggle = async (value: boolean) => {
    setScheduledNotifsEnabled(value);
    if (!token) return;
    setSavingNotifPref(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledNotificationsEnabled: value }),
      });
      void syncDeviceTimezone(token);
      void registerAndSyncPushToken(token);
    } catch {
      /* revert on failure */
      setScheduledNotifsEnabled(!value);
    } finally {
      setSavingNotifPref(false);
    }
  };

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
              const res = await apiFetch("/auth/account", {
                method: "DELETE",
                token,
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
      contentContainerStyle={{
        paddingTop: topPad + sui.topExtra,
        paddingBottom: botPad + sui.botExtra,
        paddingHorizontal: gutter,
        maxWidth: LAYOUT.contentMaxWidth,
        width: "100%",
        alignSelf: "center",
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { fontSize: sui.titleFs, marginBottom: sui.titleMb }]}>Settings</Text>
      <Text style={[styles.screenSub, { fontSize: sui.subFs, marginBottom: sui.subMb }]}>
        Account and prayer preferences
      </Text>

      <View style={[styles.section, { gap: sui.sectionGap, marginBottom: sui.sectionMb }]}>
        <Text style={[styles.sectionTitle, { fontSize: sui.sectionTitleFs, letterSpacing: sui.sectionLs }]}>
          Preferences
        </Text>
        <View
          style={[
            styles.menuCard,
            { borderRadius: sui.cardRad, borderWidth: sui.cardBorderW },
          ]}
        >
          <Pressable
            style={[
              styles.menuItem,
              { paddingHorizontal: sui.menuPadH, paddingVertical: sui.menuPadV, gap: sui.menuGap },
            ]}
            onPress={() => router.push("/onboarding")}
          >
            <Feather name="heart" size={sui.menuIcon} color={colors.primary} />
            <Text style={[styles.menuItemText, { fontSize: sui.menuTextFs }]}>Prayer preferences</Text>
            <Feather name="chevron-right" size={sui.chevIcon} color={colors.muted} />
          </Pressable>
          <View
            style={[
              styles.menuItem,
              styles.menuItemLast,
              { paddingHorizontal: sui.menuPadH, paddingVertical: sui.menuPadV, gap: sui.menuGap },
            ]}
          >
            <Ionicons name="notifications-outline" size={sui.menuIcon} color={colors.primary} />
            <Text style={[styles.menuItemText, { fontSize: sui.menuTextFs }]}>
              Morning &amp; Evening Reminders
            </Text>
            <Switch
              value={scheduledNotifsEnabled}
              onValueChange={(v) => void handleNotifToggle(v)}
              disabled={savingNotifPref}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
        </View>
      </View>

      {(user.role === "admin" || user.role === "moderator") && (
        <View style={[styles.section, { gap: sui.sectionGap, marginBottom: sui.sectionMb }]}>
          <Text style={[styles.sectionTitle, { fontSize: sui.sectionTitleFs, letterSpacing: sui.sectionLs }]}>
            Team
          </Text>
          <View
            style={[
              styles.menuCard,
              { borderRadius: sui.cardRad, borderWidth: sui.cardBorderW },
            ]}
          >
            <Pressable
              style={[
                styles.menuItem,
                styles.menuItemLast,
                { paddingHorizontal: sui.menuPadH, paddingVertical: sui.menuPadV, gap: sui.menuGap },
              ]}
              onPress={() => openWebAdmin("/dashboard/moderation")}
            >
              <View style={[styles.teamRow, { gap: sui.teamGap }]}>
                <Ionicons name="shield-checkmark-outline" size={sui.menuIcon} color={colors.accent} />
                {modPending > 0 && (
                  <View
                    style={[
                      styles.settingsModPill,
                      {
                        minWidth: sui.modPillMinW,
                        height: sui.modPillH,
                        paddingHorizontal: sui.modPillPadH,
                        borderRadius: sui.modPillRad,
                      },
                    ]}
                  >
                    <Text style={[styles.settingsModPillText, { fontSize: sui.modPillFs }]}>
                      {modPending > 99 ? "99+" : String(modPending)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.menuItemText, { color: colors.accent, fontSize: sui.menuTextFs }]}>
                Team dashboard
              </Text>
              <Feather name="external-link" size={sui.chevIcon} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.section, { gap: sui.sectionGap, marginBottom: sui.sectionMb }]}>
        <Text style={[styles.sectionTitle, { fontSize: sui.sectionTitleFs, letterSpacing: sui.sectionLs }]}>
          Account
        </Text>
        <View
          style={[
            styles.menuCard,
            { borderRadius: sui.cardRad, borderWidth: sui.cardBorderW },
          ]}
        >
          <Pressable
            style={[
              styles.menuItem,
              { paddingHorizontal: sui.menuPadH, paddingVertical: sui.menuPadV, gap: sui.menuGap },
            ]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Feather name="trash-2" size={sui.menuIcon} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger, fontSize: sui.menuTextFs }]}>
              {deletingAccount ? "Deleting…" : "Delete account"}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.menuItem,
              styles.menuItemLast,
              { paddingHorizontal: sui.menuPadH, paddingVertical: sui.menuPadV, gap: sui.menuGap },
            ]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={sui.menuIcon} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger, fontSize: sui.menuTextFs }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.legalRow, { gap: sui.legalGap, marginTop: sui.legalMt }]}>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={[styles.legalLink, { fontSize: sui.legalFs }]}>Terms of Service</Text>
        </Pressable>
        <Text style={[styles.legalDot, { fontSize: sui.legalFs }]}>·</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={[styles.legalLink, { fontSize: sui.legalFs }]}>Privacy</Text>
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
    minWidth: 0,
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
