import { Feather, Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import { getGetPathQueryKey, useGetPath } from "@workspace/api-client-react";
import type { OfficialPrayer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import colors from "@/constants/colors";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { iconKeyForPathCategory } from "@/constants/pathCategoryIcon";
import { emojiForLibraryCategory } from "@/constants/libraryFallbackPaths";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { officialGuideBadgeLabel, type OfficialPrayerRow } from "@/lib/officialPrayer";
import { apiFetch } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";

function toOfficialRow(p: OfficialPrayer & { audioUrl?: string | null; scheduleSlot?: string | null }): OfficialPrayerRow {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? null,
    content: p.content ?? "",
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
  const { uiScale, iconAction, cardRadius } = useResponsiveLayout();
  const mins = op.durationMinutes;
  const headerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const headerMb = Math.round(clamp(10 * uiScale, 8, 12));
  const cardPad = Math.round(clamp(16 * uiScale, 14, 20));
  const cardRad = Math.round(clamp(cardRadius * 0.65, 16, 22));
  const badgePadH = Math.round(clamp(10 * uiScale, 8, 12));
  const badgePadV = Math.round(clamp(4 * uiScale, 3, 5));
  const fsBadge = Math.round(clamp(11 * uiScale, 10, 12));
  const fsTitle = Math.round(clamp(17 * uiScale, 15, 20));
  const titleMb = Math.round(clamp(6 * uiScale, 5, 8));
  const fsScripture = Math.round(clamp(13 * uiScale, 12, 15));
  const scrMb = Math.round(clamp(12 * uiScale, 10, 14));
  const hit = Math.round(clamp(8 * uiScale, 6, 10));

  return (
    <View style={[styles.sessionCard, { padding: cardPad, borderRadius: cardRad, marginBottom: Math.round(4 * uiScale) }]}>
      <View style={[styles.sessionCardHeader, { gap: headerGap, marginBottom: headerMb }]}>
        <Ionicons name="pulse-outline" size={iconAction} color={colors.primary} />
        <View style={[styles.durationBadge, { paddingHorizontal: badgePadH, paddingVertical: badgePadV }]}>
          <Text style={[styles.durationBadgeText, { fontSize: fsBadge }]}>
            {!op.audioUrl && mins != null && mins > 0
              ? `${mins} MINS`
              : officialGuideBadgeLabel(op.label)}
          </Text>
        </View>
        {showSave ? (
          <Pressable onPress={onToggleSave} style={styles.sessionSave} hitSlop={hit} accessibilityRole="button">
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={iconAction} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      <Text style={[styles.sessionCardTitle, { fontSize: fsTitle, marginBottom: titleMb }]}>{op.title}</Text>
      {op.scripture ? (
        <Text style={[styles.sessionScripture, { fontSize: fsScripture, marginBottom: scrMb }]}>{op.scripture}</Text>
      ) : null}
      {op.audioUrl ? (
        <CapsuleAudioPlayer audioUrl={op.audioUrl} accentColor={colors.primary} />
      ) : null}
    </View>
  );
}

export default function PathDetailScreen() {
  useStackHeaderBack("/(tabs)/library" as Href);
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathId = Number(id);
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetPath(pathId, {
    query: {
      queryKey: getGetPathQueryKey(pathId),
      enabled: Number.isFinite(pathId) && pathId > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    },
  });

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const scrollBot = Math.round(clamp(40 * uiScale, 32, 48));
  const heroPadH = Math.round(clamp(22 * uiScale, gutter, 28));
  const heroPadV = Math.round(clamp(24 * uiScale, 20, 30));
  const heroGap = Math.round(clamp(10 * uiScale, 8, 12));
  const heroIconBox = Math.round(clamp(64 * uiScale, 56, 76));
  const heroIconRad = Math.round(clamp(20 * uiScale, 16, 24));
  const heroFeather = Math.round(clamp(28 * uiScale, 24, 32));
  const fsHeroTitle = Math.round(clamp(22 * uiScale, 20, 26));
  const fsHeroDesc = Math.round(clamp(14 * uiScale, 13, 16));
  const lhHeroDesc = Math.round(fsHeroDesc * 2);
  const sectionPadT = Math.round(clamp(20 * uiScale, 16, 24));
  const sectionGap = Math.round(clamp(12 * uiScale, 10, 14));
  const fsSectionTitle = Math.round(clamp(13 * uiScale, 12, 15));
  const fsEmpty = Math.round(clamp(14 * uiScale, 13, 16));
  const lhEmpty = Math.round(fsEmpty * 1.4);
  const emptyPadV = Math.round(clamp(16 * uiScale, 14, 20));

  const savedIds = useMemo(() => {
    const saved = data?.savedOfficialPrayers ?? [];
    return new Set(saved.map((p: OfficialPrayer) => p.id));
  }, [data?.savedOfficialPrayers]);

  const toggleSave = useCallback(
    async (prayerId: number, currentlySaved: boolean) => {
      if (!token) return;
      const method = currentlySaved ? "DELETE" : "POST";
      const res = await apiFetch(`/library/saved-official/${prayerId}`, {
        method,
        token,
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: getGetPathQueryKey(pathId) });
      }
    },
    [token, queryClient, pathId],
  );

  if ((isLoading && !data) || !data) {
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
  const heroEmoji = emojiForLibraryCategory({
    name: path.name,
    category: path.category,
    pathId: path.id,
  });
  const iconName = (FEATHER_ICON_MAP[iconKeyForPathCategory(path.category)] ?? "star") as keyof typeof Feather.glyphMap;
  const official = (path.officialPrayers ?? []).map(toOfficialRow);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: botPad + scrollBot }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroLight, { paddingHorizontal: heroPadH, paddingVertical: heroPadV, gap: heroGap }]}>
        {heroEmoji ? (
          <Text style={[styles.heroEmoji, { fontSize: Math.round(heroIconBox * 0.62) }]} allowFontScaling>
            {heroEmoji}
          </Text>
        ) : (
          <View
            style={[
              styles.heroIconLight,
              {
                width: heroIconBox,
                height: heroIconBox,
                borderRadius: heroIconRad,
              },
            ]}
          >
            <Feather name={iconName} size={heroFeather} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.heroPathTitle, { fontSize: fsHeroTitle }]}>{path.name}</Text>
        {path.tagline?.trim() ? (
          <Text style={[styles.heroPathTagline, { fontSize: fsHeroDesc }]}>{path.tagline.trim()}</Text>
        ) : null}
        {path.description?.trim() ? (
          <FormattedBodyText
            text={path.description}
            style={styles.heroPathDesc}
            fontSize={fsHeroDesc}
            lineHeight={lhHeroDesc}
          />
        ) : null}
      </View>

      <View style={[styles.section, { paddingHorizontal: gutter, paddingTop: sectionPadT, gap: sectionGap }]}>
        <Text style={[styles.sectionTitle, { fontSize: fsSectionTitle }]}>Guided official prayers</Text>
        {official.length === 0 ? (
          <View style={[styles.emptyInline, { paddingVertical: emptyPadV }]}>
            <Text style={[styles.emptyInlineText, { fontSize: fsEmpty, lineHeight: lhEmpty }]}>
              Official guides for this path will appear here.
            </Text>
          </View>
        ) : (
          official.map((op) => (
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  heroIconLight: {
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroEmoji: {
    textAlign: "center",
  },
  heroPathTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  heroPathTagline: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
    textAlign: "center",
  },
  heroPathDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  section: {},
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyInline: {},
  emptyInlineText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  durationBadge: {
    backgroundColor: "#E3EEF9",
    borderRadius: 999,
  },
  durationBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
    letterSpacing: 0.4,
  },
  sessionSave: { marginLeft: "auto" },
  sessionCardTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.text,
  },
  sessionScripture: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.muted,
  },
});
