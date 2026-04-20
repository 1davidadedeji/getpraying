import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { getGetPathQueryKey, useGetPath } from "@workspace/api-client-react";
import type { OfficialPrayer, Post } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfficialGuidePlayCircle, type OfficialGuidePlayHandle } from "@/components/OfficialGuidePlayCircle";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { iconKeyForPathCategory } from "@/constants/pathCategoryIcon";
import { useAuth } from "@/context/auth";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { apiUrl, authHeaders } from "@/lib/api";

function toOfficialRow(p: OfficialPrayer & { audioUrl?: string | null; scheduleSlot?: string | null }): OfficialPrayerRow {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? null,
    content: p.content,
    category: p.category,
    label: p.label ?? null,
    scheduleSlot: p.scheduleSlot ?? null,
    pathId: (p as { pathId?: number | null }).pathId ?? null,
    uploadedByUsername: (p as { uploadedByUsername?: string | null }).uploadedByUsername ?? null,
    uploadedByDisplayName: (p as { uploadedByDisplayName?: string | null }).uploadedByDisplayName ?? null,
    scripture: p.scripture ?? null,
    audioUrl: p.audioUrl ?? (p as { audioUrl?: string | null }).audioUrl ?? null,
    durationMinutes: p.durationMinutes ?? null,
    createdAt: p.createdAt as string | Date | null,
  };
}

function PathSessionCard({
  op,
  isSaved,
  onToggleSave,
  showSave,
}: {
  op: OfficialPrayerRow;
  isSaved: boolean;
  onToggleSave: () => void;
  showSave: boolean;
}) {
  const playRef = useRef<OfficialGuidePlayHandle>(null);
  const mins = op.durationMinutes;
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionCardHeader}>
        <Ionicons name="pulse-outline" size={22} color={colors.primary} />
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>
            {mins != null && mins > 0 ? `${mins} MINS` : "SESSION"}
          </Text>
        </View>
        {showSave ? (
          <Pressable onPress={onToggleSave} style={styles.sessionSave} hitSlop={8} accessibilityRole="button">
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      <Text style={styles.sessionCardTitle}>{op.title}</Text>
      {op.scripture ? <Text style={styles.sessionScripture}>{op.scripture}</Text> : null}
      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { width: "30%" }]} />
      </View>
      <View style={styles.sessionCardFooter}>
        <Pressable
          style={styles.listenPill}
          onPress={() => playRef.current?.toggle()}
          accessibilityRole="button"
          accessibilityLabel="Play session"
        >
          <Text style={styles.listenPillText}>Listen</Text>
        </Pressable>
        <OfficialGuidePlayCircle ref={playRef} audioUrl={op.audioUrl} size={56} />
      </View>
    </View>
  );
}

export default function PathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathId = Number(id);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetPath(pathId);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const savedIds = useMemo(() => {
    const saved = data?.savedOfficialPrayers ?? [];
    return new Set(saved.map((p: OfficialPrayer) => p.id));
  }, [data?.savedOfficialPrayers]);

  const toggleSave = useCallback(
    async (prayerId: number, currentlySaved: boolean) => {
      if (!token) return;
      const method = currentlySaved ? "DELETE" : "POST";
      const res = await fetch(apiUrl(`/library/saved-official/${prayerId}`), {
        method,
        headers: authHeaders(token),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: getGetPathQueryKey(pathId) });
      }
    },
    [token, queryClient, pathId],
  );

  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : (
          <Text style={styles.errorText}>Prayer path not found</Text>
        )}
      </View>
    );
  }

  const path = data;
  const iconName = (FEATHER_ICON_MAP[iconKeyForPathCategory(path.category)] ?? "star") as keyof typeof Feather.glyphMap;
  const official = (path.officialPrayers ?? []).map(toOfficialRow);
  const pathSessions = official.slice(0, 2);
  const communityPosts = (path.savedPosts ?? []) as Post[];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: botPad + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroLight}>
        <View style={styles.heroIconLight}>
          <Feather name={iconName} size={28} color={colors.primary} />
        </View>
        <Text style={styles.heroPathTitle}>{path.name}</Text>
        <Text style={styles.heroLead}>
          {path.tagline?.trim() ||
            path.description ||
            "Explore curated sessions designed to anchor your heart."}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guided official prayers</Text>
        {pathSessions.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>
              Sanctuary sessions archived to this path will appear here.
            </Text>
          </View>
        ) : (
          pathSessions.map((op) => (
            <PathSessionCard
              key={op.id}
              op={op}
              showSave={!!token}
              isSaved={savedIds.has(op.id)}
              onToggleSave={() => void toggleSave(op.id, savedIds.has(op.id))}
            />
          ))
        )}
      </View>

      {communityPosts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved in this path</Text>
          <Text style={styles.sectionHint}>Prayers you saved that match this theme.</Text>
          {communityPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  errorText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: colors.muted,
  },
  heroLight: {
    backgroundColor: colors.surface,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
    gap: 10,
  },
  heroIconLight: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPathTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
    textAlign: "center",
  },
  heroLead: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
    lineHeight: 18,
  },
  emptyInline: {
    paddingVertical: 16,
  },
  emptyInlineText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  durationBadge: {
    backgroundColor: "#E3EEF9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  durationBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.4,
  },
  sessionSave: { marginLeft: "auto" },
  sessionCardTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 17,
    color: colors.text,
    marginBottom: 6,
  },
  sessionScripture: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  progressOuter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressInner: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sessionCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listenPill: {
    flex: 1,
    marginRight: 12,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  listenPillText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
  },
});
