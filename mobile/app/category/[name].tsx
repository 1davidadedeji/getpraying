import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
import colors from "@/constants/colors";
import { LAYOUT } from "@/constants/layout";
import { emojiForLibraryCategory } from "@/constants/libraryFallbackPaths";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { apiFetch } from "@/lib/api";
import { fetchLibraryCached, peekLibraryCache } from "@/lib/libraryFetchCache";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { clamp } from "@/lib/responsiveMetrics";

const LOAD_TIMEOUT_MS = 25_000;

export default function CategoryOfficialScreen() {
  useStackHeaderBack("/(tabs)/library" as Href);
  const { name } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const listBotPad = Math.round(clamp(100 * uiScale, 88, 112));
  const { token } = useAuth();
  const [guides, setGuides] = useState<OfficialPrayerRow[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const categorySlug = name ? decodeURIComponent(name).toLowerCase() : "";
  const categoryDisplay = categorySlug ? categorySlug.replace(/^\w/, (c) => c.toUpperCase()) : "";
  const categoryEmoji = emojiForLibraryCategory({
    name: categoryDisplay,
    slug: categorySlug,
    category: categorySlug,
  });

  const loadGuides = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!categorySlug) {
        setGuides([]);
        return true;
      }
      const params = new URLSearchParams({
        category: categorySlug,
        excludeScheduled: "1",
        limit: "120",
      });
      const officialPath = `/library/official?${params}`;
      const startedAt = Date.now();
      const officialData = await fetchLibraryCached<{ prayers?: OfficialPrayerRow[] }>(
        officialPath,
        token,
        { force: opts?.force, timeoutMs: LOAD_TIMEOUT_MS },
      );
      if (!officialData) {
        if (__DEV__) console.warn("[library] category guides failed", { categorySlug, ms: Date.now() - startedAt });
        return false;
      }
      setGuides(officialData.prayers ?? []);
      if (__DEV__) {
        console.info("[library] category guides ok", {
          categorySlug,
          count: officialData.prayers?.length ?? 0,
          ms: Date.now() - startedAt,
        });
      }
      return true;
    },
    [categorySlug, token],
  );

  const loadSavedIds = useCallback(async () => {
    if (!token) {
      setSavedIds(new Set());
      return;
    }
    try {
      const savedData = await fetchLibraryCached<{ prayers?: OfficialPrayerRow[] }>(
        "/library/saved-official",
        token,
        { timeoutMs: LOAD_TIMEOUT_MS },
      );
      if (savedData?.prayers) {
        setSavedIds(new Set(savedData.prayers.map((p) => p.id)));
      }
    } catch {
      /* non-blocking */
    }
  }, [token]);

  const loadInitial = useCallback(async () => {
    setError(false);
    // Stale-while-revalidate: render the pre-warmed cache instantly (no
    // full-screen spinner) and revalidate in the background. Eliminates the
    // "rolling loader" when navigating in from the Library grid.
    let hasCached = false;
    if (categorySlug) {
      const params = new URLSearchParams({
        category: categorySlug,
        excludeScheduled: "1",
        limit: "120",
      });
      const cached = peekLibraryCache<{ prayers?: OfficialPrayerRow[] }>(
        `/library/official?${params}`,
        token,
      );
      if (cached?.prayers) {
        setGuides(cached.prayers);
        setLoading(false);
        hasCached = true;
      }
    }
    if (!hasCached) setLoading(true);
    try {
      const ok = await loadGuides();
      void loadSavedIds();
      if (!hasCached) setError(!ok);
    } catch {
      if (!hasCached) setError(true);
    } finally {
      setLoading(false);
    }
  }, [categorySlug, token, loadGuides, loadSavedIds]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const ok = await loadGuides({ force: true });
      void loadSavedIds();
      if (!ok) setError(true);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadGuides, loadSavedIds]);

  const toggleSave = useCallback(
    async (prayerId: number, currentlySaved: boolean) => {
      if (!token) return;
      const method = currentlySaved ? "DELETE" : "POST";
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(prayerId);
        else next.add(prayerId);
        return next;
      });
      try {
        const res = await apiFetch(`/library/saved-official/${prayerId}`, {
          token,
          method,
        });
        if (!res.ok) {
          setSavedIds((prev) => {
            const next = new Set(prev);
            if (currentlySaved) next.add(prayerId);
            else next.delete(prayerId);
            return next;
          });
        }
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (currentlySaved) next.add(prayerId);
          else next.delete(prayerId);
          return next;
        });
      }
    },
    [token],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={guides}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <OfficialGuideCard
          op={item}
          showSave={!!token}
          isSaved={savedIds.has(item.id)}
          onToggleSave={() => void toggleSave(item.id, savedIds.has(item.id))}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          {categoryEmoji ? (
            <Text style={styles.headerEmoji} allowFontScaling>
              {categoryEmoji}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {categoryDisplay}
          </Text>
          <Text style={styles.subtitle}>Official guides curated by Get Praying</Text>
        </View>
      }
      ListEmptyComponent={
        error ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>Connection issue</Text>
            <Text style={styles.emptySubtitle}>Pull down to try again</Text>
            <Pressable onPress={() => void loadInitial()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>No official guides yet</Text>
            <Text style={styles.emptySubtitle}>Check back soon for curated prayers in this category</Text>
          </View>
        )
      }
      contentContainerStyle={[
        styles.list,
        {
          paddingBottom: listBotPad + insets.bottom,
          paddingHorizontal: gutter,
          maxWidth: LAYOUT.contentMaxWidth,
          width: "100%",
          alignSelf: "center",
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.flame} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    backgroundColor: colors.cream,
  },
  header: {
    paddingTop: Platform.OS === "web" ? 20 : 8,
    paddingBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  headerEmoji: {
    fontSize: 36,
    textAlign: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
  },
  emptySubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.surface,
  },
});
