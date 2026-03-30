import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace("/");
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const displayName = user.displayName ?? user.username;
  const initials = displayName.slice(0, 2).toUpperCase();
  const joinYear = new Date(user.createdAt).getFullYear();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 8, paddingBottom: botPad + 60 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHero}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
        <Text style={styles.joinDate}>Member since {joinYear}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Prayers Shared" value={user.prayersShared} />
        <StatCard label="Prayed For" value={user.prayedFor} />
        <StatCard label="Saved" value={user.savedScrolls} />
      </View>

      {user.preferredCategories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Prayer Categories</Text>
          <View style={styles.chips}>
            {user.preferredCategories.map((cat) => (
              <View key={cat} style={styles.chip}>
                <Text style={styles.chipText}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={() => router.push("/onboarding")}>
            <Feather name="settings" size={18} color={colors.primary} />
            <Text style={styles.menuItemText}>Prayer Preferences</Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>

          {user.isAdmin && (
            <Pressable style={styles.menuItem} onPress={() => router.push("/admin")}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.accent }]}>Admin Panel</Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          )}

          <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  profileHero: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 4,
    marginBottom: 4,
  },
  avatar: {
    flex: 1,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: colors.accent,
  },
  displayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  username: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  joinDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: colors.flameDim,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.flame,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
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
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
});
