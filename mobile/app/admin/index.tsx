import { Feather, Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetAdminStatsQueryKey, useGetAdminStats } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

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
  const { uiScale, iconAction } = useResponsiveLayout();
  const tilePad = Math.round(clamp(14 * uiScale, 12, 18));
  const tileRad = Math.round(clamp(16 * uiScale, 14, 20));
  const tileGap = Math.round(clamp(12 * uiScale, 10, 14));
  const tileMb = Math.round(clamp(10 * uiScale, 8, 12));
  const iconBox = Math.round(clamp(44 * uiScale, 40, 50));
  const iconRad = Math.round(clamp(12 * uiScale, 10, 14));
  const chev = Math.round(clamp(18 * uiScale, 16, 20));
  const fsTitle = Math.round(clamp(16 * uiScale, 15, 18));
  const fsSub = Math.round(clamp(13 * uiScale, 12, 15));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          padding: tilePad,
          borderRadius: tileRad,
          gap: tileGap,
          marginBottom: tileMb,
        },
        pressed && styles.tilePressed,
      ]}
    >
      <View style={[styles.tileIcon, { width: iconBox, height: iconBox, borderRadius: iconRad }]}>
        <Feather name={icon} size={iconAction} color={colors.primary} />
      </View>
      <View style={styles.tileText}>
        <Text style={[styles.tileTitle, { fontSize: fsTitle }]}>{title}</Text>
        <Text style={[styles.tileSub, { fontSize: fsSub }]}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={chev} color={colors.muted} />
    </Pressable>
  );
}

export default function AdminHubScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
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

  const denyPad = Math.round(clamp(32 * uiScale, 24, 40));
  const denyGap = Math.round(clamp(12 * uiScale, 10, 14));
  const backIcn = Math.round(clamp(22 * uiScale, 20, 26));
  const lockIcn = Math.round(clamp(40 * uiScale, 34, 46));
  const fsDenyTitle = Math.round(clamp(20 * uiScale, 18, 24));
  const fsDenyText = Math.round(clamp(14 * uiScale, 13, 16));
  const lhDeny = Math.round(fsDenyText * 1.4);
  const fsBack = Math.round(clamp(16 * uiScale, 15, 18));
  const scrollTop = Math.round(clamp(12 * uiScale, 10, 14));
  const scrollBot = Math.round(clamp(32 * uiScale, 24, 40));
  const fsHero = Math.round(clamp(26 * uiScale, 22, 30));
  const heroMb = Math.round(clamp(6 * uiScale, 4, 8));
  const fsHeroSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhHeroSub = Math.round(fsHeroSub * 1.4);
  const heroSubMb = Math.round(clamp(20 * uiScale, 16, 24));
  const statGap = Math.round(clamp(10 * uiScale, 8, 12));
  const statMb = Math.round(clamp(20 * uiScale, 16, 24));
  const statPad = Math.round(clamp(12 * uiScale, 10, 14));
  const statRad = Math.round(clamp(16 * uiScale, 14, 18));
  const fsStatVal = Math.round(clamp(20 * uiScale, 18, 24));
  const fsStatLbl = Math.round(clamp(11 * uiScale, 10, 12));

  if (!isModerator) {
    return (
      <View style={[styles.accessDenied, { padding: denyPad, gap: denyGap }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as Href))}
          style={[styles.accessDeniedBack, { top: (Platform.OS === "web" ? 16 : insets.top) + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={backIcn} color={colors.primary} />
          <Text style={[styles.accessDeniedBackText, { fontSize: fsBack }]}>Back</Text>
        </Pressable>
        <Ionicons name="lock-closed-outline" size={lockIcn} color={colors.muted} />
        <Text style={[styles.accessDeniedTitle, { fontSize: fsDenyTitle }]}>Restricted</Text>
        <Text style={[styles.accessDeniedText, { fontSize: fsDenyText, lineHeight: lhDeny }]}>
          Moderators and admins can open this area from the profile menu.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: topPad + scrollTop,
        paddingBottom: botPad + scrollBot,
        paddingHorizontal: gutter,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heroTitle, { fontSize: fsHero, marginBottom: heroMb }]}>Admin</Text>
      <Text style={[styles.heroSub, { fontSize: fsHeroSub, lineHeight: lhHeroSub, marginBottom: heroSubMb }]}>
        Choose a section. Use the back arrow to return here.
      </Text>

      {isAdmin && stats ? (
        <View style={[styles.statsRow, { gap: statGap, marginBottom: statMb }]}>
          <View style={[styles.statBox, { padding: statPad, borderRadius: statRad }]}>
            <Text style={[styles.statVal, { fontSize: fsStatVal }]}>{stats.pendingPosts ?? 0}</Text>
            <Text style={[styles.statLbl, { fontSize: fsStatLbl }]}>Pending</Text>
          </View>
          <View style={[styles.statBox, { padding: statPad, borderRadius: statRad }]}>
            <Text style={[styles.statVal, { fontSize: fsStatVal }]}>{stats.approvedPosts ?? 0}</Text>
            <Text style={[styles.statLbl, { fontSize: fsStatLbl }]}>Approved</Text>
          </View>
          <View style={[styles.statBox, { padding: statPad, borderRadius: statRad }]}>
            <Text style={[styles.statVal, { fontSize: fsStatVal }]}>{stats.totalUsers ?? 0}</Text>
            <Text style={[styles.statLbl, { fontSize: fsStatLbl }]}>Users</Text>
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
    color: colors.primary,
  },
  heroSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  statsRow: {
    flexDirection: "row",
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  statLbl: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 2,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePressed: { opacity: 0.92 },
  tileIcon: {
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { flex: 1 },
  tileTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.text,
  },
  tileSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 2,
  },
  accessDenied: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  accessDeniedBack: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 1,
  },
  accessDeniedBackText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  accessDeniedTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  accessDeniedText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
});
