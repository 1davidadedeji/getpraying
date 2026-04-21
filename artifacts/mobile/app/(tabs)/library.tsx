import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SanctuarySlotCard } from "@/components/SanctuarySlotCard";
import { SavedOfficialPrayersList } from "@/components/SavedOfficialPrayersList";
import colors from "@/constants/colors";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import {
  LIBRARY_FALLBACK_PATHS,
  type ApiLibraryCategory,
  type LibraryPathCard,
} from "@/constants/libraryFallbackPaths";

type Tab = "categories" | "saved";
type CategoryItem = LibraryPathCard | ApiLibraryCategory;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const categoriesScrollRef = useRef<ScrollView>(null);
  const savedListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<CategoryItem[]>(LIBRARY_FALLBACK_PATHS);
  const [loadingCats, setLoadingCats] = useState(false);
  const [sanctuary, setSanctuary] = useState<{
    morning: OfficialPrayerRow | null;
    evening: OfficialPrayerRow | null;
  }>({ morning: null, evening: null });
  const [loadingOfficial, setLoadingOfficial] = useState(false);
  const [savedOfficialIds, setSavedOfficialIds] = useState<Set<number>>(new Set());

  const scrollLibraryToTop = useCallback(() => {
    if (activeTab === "categories") {
      categoriesScrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      savedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [activeTab]);

  useTabScrollToTop(scrollLibraryToTop);

  const loadSavedOfficialIds = useCallback(async () => {
    if (!token) {
      setSavedOfficialIds(new Set());
      return;
    }
    try {
      const res = await fetch(apiUrl("/library/saved-official"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set<number>(
        ((data as { prayers?: { id: number }[] }).prayers ?? []).map((p) => p.id),
      );
      setSavedOfficialIds(ids);
    } catch {
      /* silent */
    }
  }, [token]);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetch(apiUrl("/library/categories"), { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        const apiList = Array.isArray(data) ? (data as ApiLibraryCategory[]) : [];
        setCategories(apiList.length > 0 ? apiList : LIBRARY_FALLBACK_PATHS);
      } else {
        setCategories(LIBRARY_FALLBACK_PATHS);
      }
    } catch {
      setCategories(LIBRARY_FALLBACK_PATHS);
    } finally {
      setLoadingCats(false);
    }
  }, [token]);

  const loadSanctuary = useCallback(async () => {
    setLoadingOfficial(true);
    try {
      const res = await fetch(apiUrl("/library/official/sanctuary"), {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          morning?: OfficialPrayerRow | null;
          evening?: OfficialPrayerRow | null;
        };
        setSanctuary({
          morning: data.morning ?? null,
          evening: data.evening ?? null,
        });
      }
    } catch {
      setSanctuary({ morning: null, evening: null });
    } finally {
      setLoadingOfficial(false);
    }
  }, [token]);

  /** Optimistic toggle — updates UI immediately, reverts on failure */
  const toggleSaveOfficial = useCallback(
    async (id: number) => {
      if (!token) return;
      const wasSaved = savedOfficialIds.has(id);

      // Optimistic update
      setSavedOfficialIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        const res = await fetch(apiUrl(`/library/saved-official/${id}`), {
          method: wasSaved ? "DELETE" : "POST",
          headers: authHeaders(token),
        });
        if (!res.ok) {
          // Revert on failure
          setSavedOfficialIds((prev) => {
            const next = new Set(prev);
            if (wasSaved) next.add(id);
            else next.delete(id);
            return next;
          });
        }
      } catch {
        // Revert on network error
        setSavedOfficialIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [token, savedOfficialIds],
  );

  useEffect(() => {
    if (activeTab === "categories") {
      void loadCategories();
      void loadSanctuary();
      void loadSavedOfficialIds();
    }
  }, [activeTab, loadCategories, loadSanctuary, loadSavedOfficialIds]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const screenWidth = Dimensions.get("window").width;
  const isTablet = screenWidth >= 768;
  const SITUATION_COLS = isTablet ? 4 : 3;
  const cardGap = 10;
  const horizontalPad = 16;
  const totalGaps = (SITUATION_COLS - 1) * cardGap;
  const cardWidth = (screenWidth - horizontalPad * 2 - totalGaps) / SITUATION_COLS;

  const tabs: { key: Tab; label: string; icon: "book-open" | "bookmark" }[] = [
    { key: "categories", label: "Official Prayers", icon: "book-open" },
    { key: "saved", label: "Saved", icon: "bookmark" },
  ];

  const openPath = (cat: CategoryItem) => {
    if (cat.pathId != null && cat.pathId > 0) {
      router.push(`/path/${cat.pathId}` as never);
    } else {
      const slug =
        "slug" in cat && cat.slug
          ? cat.slug
          : cat.name
              .toLowerCase()
              .replace(/[^a-z0-9/]+/g, "-")
              .replace(/^-|-$/g, "");
      router.push(`/category/${encodeURIComponent(slug)}` as never);
    }
  };

  const renderSituationCard = (cat: CategoryItem) => {
    const key =
      cat.pathId != null && cat.pathId > 0
        ? `p-${cat.pathId}`
        : `c-${"slug" in cat && cat.slug ? cat.slug : cat.name}`;
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [
          styles.situationCard,
          { width: cardWidth },
          pressed && styles.cardPressed,
        ]}
        onPress={() => openPath(cat)}
      >
        <View style={styles.situationIconBg}>
          <Feather
            name={(FEATHER_ICON_MAP[cat.icon] ?? "star") as any}
            size={20}
            color={colors.surface}
          />
        </View>
        <Text style={styles.situationName} numberOfLines={2}>
          {cat.name}
        </Text>
        {cat.count > 0 ? (
          <Text style={styles.situationCount}>{cat.count}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.libraryLabel}>LIBRARY</Text>
            <Text style={styles.title}>Official Prayers</Text>
          </View>
          <Pressable
            style={styles.searchBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search prayers"
          >
            <Feather name="search" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather
              name={t.icon}
              size={13}
              color={activeTab === t.key ? colors.surface : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Official Prayers Tab */}
      {activeTab === "categories" && (
        <ScrollView
          ref={categoriesScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        >
          {/* Today's Sanctuary — morning first */}
          {loadingOfficial ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : !sanctuary.morning && !sanctuary.evening ? (
            <View style={styles.emptySlots}>
              <Ionicons name="book-outline" size={36} color={colors.muted} />
              <Text style={styles.officialEmpty}>
                Morning and evening sanctuary guides will appear here.
              </Text>
            </View>
          ) : (
            <>
              {sanctuary.morning ? (
                <SanctuarySlotCard
                  slot="morning"
                  prayer={sanctuary.morning}
                  showSave={!!token}
                  isSaved={savedOfficialIds.has(sanctuary.morning.id)}
                  onToggleSave={() => void toggleSaveOfficial(sanctuary.morning!.id)}
                />
              ) : null}
              {sanctuary.evening ? (
                <SanctuarySlotCard
                  slot="evening"
                  prayer={sanctuary.evening}
                  showSave={!!token}
                  isSaved={savedOfficialIds.has(sanctuary.evening.id)}
                  onToggleSave={() => void toggleSaveOfficial(sanctuary.evening!.id)}
                />
              ) : null}
            </>
          )}

          {/* For Your Situation */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>For Your Situation</Text>
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
          </View>

          {loadingCats ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : (
            <View style={styles.situationGrid}>
              {categories.map((c) => renderSituationCard(c))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Saved Tab */}
      {activeTab === "saved" && (
        <SavedOfficialPrayersList
          listRef={savedListRef}
          queryEnabled
          invalidateOnFocus
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          onToggleSave={(id) => {
            setSavedOfficialIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 6,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerTitles: {
    flex: 1,
  },
  libraryLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    marginBottom: 2,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 26,
    color: colors.primary,
    lineHeight: 32,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 2,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  officialEmpty: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
  emptySlots: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 8,
    gap: 8,
  },
  loader: {
    marginTop: 32,
  },
  situationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  situationCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.82,
  },
  situationIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  situationName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
  },
  situationCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
});
