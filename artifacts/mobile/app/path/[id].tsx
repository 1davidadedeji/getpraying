import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { getGetPathQueryKey, useGetPath } from "@workspace/api-client-react";
import type { OfficialPrayer, Post } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "@/components/PostCard";
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
import colors from "@/constants/colors";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { iconKeyForPathCategory } from "@/constants/pathCategoryIcon";
import { useAuth } from "@/context/auth";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { apiUrl, authHeaders } from "@/lib/api";

function toOfficialRow(p: OfficialPrayer): OfficialPrayerRow {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? null,
    content: p.content,
    category: p.category,
    label: p.label ?? null,
    scheduleSlot: p.scheduleSlot ?? null,
    pathId: p.pathId ?? null,
    uploadedByUsername: p.uploadedByUsername ?? null,
    uploadedByDisplayName: p.uploadedByDisplayName ?? null,
    scripture: p.scripture ?? null,
  };
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
  const communityPosts = (path.savedPosts ?? []) as Post[];
  const pathScripture = path.officialPrayers?.find((p) => p.scripture)?.scripture;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: botPad + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Feather name={iconName} size={32} color={colors.surface} />
        </View>
        <Text style={styles.heroTitle}>{path.name}</Text>
        {path.description ? <Text style={styles.heroDesc}>{path.description}</Text> : null}
        {path.tagline ? (
          <Text style={styles.heroTagline} numberOfLines={2}>
            {path.tagline}
          </Text>
        ) : null}
        <View style={styles.heroMeta}>
          <Ionicons name="book-outline" size={16} color={colors.accent} />
          <Text style={styles.heroMetaText}>{official.length} official guides in this path</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Official guides</Text>
        {official.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>No guides in this path yet.</Text>
          </View>
        ) : (
          official.map((op) => (
            <OfficialGuideCard
              key={op.id}
              op={op}
              showSave={!!token}
              isSaved={savedIds.has(op.id)}
              onToggleSave={() => void toggleSave(op.id, savedIds.has(op.id))}
            />
          ))
        )}
      </View>

      {pathScripture ? (
        <View style={styles.scriptureBadge}>
          <Ionicons name="bookmarks-outline" size={16} color={colors.primary} />
          <Text style={styles.scriptureText}>{pathScripture}</Text>
        </View>
      ) : null}

      {communityPosts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From the community</Text>
          <Text style={styles.sectionHint}>Saved feed posts that match this path&apos;s theme.</Text>
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
  heroSection: {
    backgroundColor: colors.primary,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(212,160,67,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,160,67,0.4)",
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.surface,
    textAlign: "center",
  },
  heroDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  heroTagline: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  heroMetaText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.accent,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
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
  },
  scriptureBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scriptureText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  },
});
