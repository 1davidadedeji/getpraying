import { Feather, Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetAdminStatsQueryKey, useGetAdminStats } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

function HubTile({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <View style={styles.tileIcon}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function AdminHubScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator" || isAdmin;

  const { data: statsData } = useGetAdminStats({
    query: {
      queryKey: getGetAdminStatsQueryKey(),
      enabled: isAdmin,
    },
  });
  const stats = statsData as { pendingPosts?: number; approvedPosts?: number; totalUsers?: number } | undefined;

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (!isModerator) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.muted} />
        <Text style={styles.accessDeniedTitle}>Restricted</Text>
        <Text style={styles.accessDeniedText}>
          Moderators and admins can open this area from the profile menu.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 32, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heroTitle}>Admin</Text>
      <Text style={styles.heroSub}>Choose a section. Use the back arrow to return here.</Text>

      {isAdmin && stats ? (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.pendingPosts ?? 0}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.approvedPosts ?? 0}</Text>
            <Text style={styles.statLbl}>Approved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.totalUsers ?? 0}</Text>
            <Text style={styles.statLbl}>Users</Text>
          </View>
        </View>
      ) : null}

      <HubTile
        title="Moderation queue"
        subtitle="Approve or decline pending prayers"
        icon="inbox"
        onPress={() => router.push("/admin/queue" as Href)}
      />
      {isAdmin ? (
        <>
          <HubTile
            title="Today's Word"
            subtitle="Override daily verse for a date"
            icon="sun"
            onPress={() => router.push("/admin/daily-word" as Href)}
          />
          <HubTile
            title="Official guides"
            subtitle="Publish curated guides (audio)"
            icon="book-open"
            onPress={() => router.push("/admin/official-guides" as Href)}
          />
          <HubTile
            title="Users & roles"
            subtitle="Roles, ban, delete"
            icon="users"
            onPress={() => router.push("/admin/users" as Href)}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  heroTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 26,
    color: colors.primary,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginBottom: 20,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 20,
    color: colors.primary,
  },
  statLbl: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  tilePressed: { opacity: 0.92 },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { flex: 1 },
  tileTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  tileSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  accessDenied: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  accessDeniedTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: colors.primary,
  },
  accessDeniedText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
