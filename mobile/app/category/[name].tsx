import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import { apiUrl, authHeaders } from "@/lib/api";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { clamp } from "@/lib/responsiveMetrics";

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

  const loadGuides = useCallback(async () => {
    if (!categorySlug) {
      setGuides([]);
      return;
    }
    const params = new URLSearchParams({
      category: categorySlug,
      excludeScheduled: "1",
      limit: "120",
    });
    const [officialRes, savedRes] = await Promise.all([
      fetch(apiUrl(`/library/official?${params}`), { headers: authHeaders(token) }),
      token
        ? fetch(apiUrl("/library/saved-official"), { headers: authHeaders(token) })
        : Promise.resolve(null),
    ]);
    if (!officialRes.ok) throw new Error("Failed to load guides");
    const officialData = (await officialRes.json()) as { prayers?: OfficialPrayerRow[] };
    setGuides(officialData.prayers ?? []);
    if (savedRes?.ok) {
      const savedData = (await savedRes.json()) as { prayers?: OfficialPrayerRow[] };
      setSavedIds(new Set((savedData.prayers ?? []).map((p) => p.id)));
    } else {
      setSavedIds(new Set());
    }
  }, [categorySlug, token]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      await loadGuides();
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadGuides]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGuides();
    } catch {
      /* silent */
    } finally {
      setRefreshing(false);
    }
  }, [loadGuides]);

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
      const res = await fetch(apiUrl(`/library/saved-official/${prayerId}`), {
        method,
        headers: authHeaders(token),
      });
      if (!res.ok) {
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
});
