import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SanctuarySlotCard } from "@/components/SanctuarySlotCard";
import { SavedOfficialPrayersList } from "@/components/SavedOfficialPrayersList";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import { clamp, getLibraryIconBgSize, getLibrarySituationCols } from "@/lib/responsiveMetrics";
import {
  LIBRARY_FALLBACK_PATHS,
  type ApiLibraryCategory,
  type LibraryPathCard,
} from "@/constants/libraryFallbackPaths";

type Tab = "categories" | "saved";
type CategoryItem = LibraryPathCard | ApiLibraryCategory;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { windowWidth, windowHeight, gutter, isTablet, uiScale } = useResponsiveLayout();
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const toggleSearch = () => {
    if (showSearch) {
      setShowSearch(false);
      setSearchQuery("");
    } else {
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  };

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
  const SITUATION_COLS = getLibrarySituationCols(windowWidth, windowHeight, isTablet);
  const cardGap = Math.round(10 * uiScale);
  const situationRows = useMemo(() => {
    const rows: CategoryItem[][] = [];
    for (let i = 0; i < filteredCategories.length; i += SITUATION_COLS) {
      rows.push(filteredCategories.slice(i, i + SITUATION_COLS));
    }
    return rows;
  }, [filteredCategories, SITUATION_COLS]);
  const situationIconSize = Math.round(20 * uiScale);
  const situationIconBg = getLibraryIconBgSize(uiScale);
  const scrollPadBottom = Math.round(clamp(100 * uiScale, 88, 112)) + insets.bottom;
  const searchBtnSz = Math.round(clamp(40 * uiScale, 36, 46));
  const searchBtnRad = Math.round(searchBtnSz / 2);
  const searchHitSlop = Math.round(clamp(8 * uiScale, 6, 10));
  const searchInputH = Math.round(clamp(40 * uiScale, 36, 44));
  const searchInputPadH = Math.round(clamp(16 * uiScale, 12, 18));
  const searchInputRad = Math.round(clamp(20 * uiScale, 16, 22));
  const searchInputFs = Math.round(clamp(14 * uiScale, 13, 15));
  const tabIconFs = Math.round(clamp(13 * uiScale, 12, 15));
  const tabFs = Math.round(clamp(13 * uiScale, 12, 15));
  const tabH = Math.round(clamp(34 * uiScale, 30, 38));
  const tabRad = Math.round(tabH / 2);

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
    return (
      <Pressable
        style={({ pressed }) => [
          styles.situationCard,
          { width: "100%" },
          pressed && styles.cardPressed,
        ]}
        onPress={() => openPath(cat)}
      >
        <View
          style={[
            styles.situationIconBg,
            {
              width: situationIconBg,
              height: situationIconBg,
              borderRadius: situationIconBg / 2,
            },
          ]}
        >
          <Feather
            name={(FEATHER_ICON_MAP[cat.icon] ?? "star") as any}
            size={situationIconSize}
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
      <View style={[styles.shell, { maxWidth: LAYOUT.contentMaxWidth, paddingHorizontal: gutter }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.libraryLabel}>LIBRARY</Text>
            <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
              Official Prayers
            </Text>
          </View>
          <Pressable
            style={[
              styles.searchBtn,
              {
                width: searchBtnSz,
                height: searchBtnSz,
                borderRadius: searchBtnRad,
              },
              showSearch && styles.searchBtnActive,
            ]}
            hitSlop={searchHitSlop}
            onPress={toggleSearch}
            accessibilityRole="button"
            accessibilityLabel={showSearch ? "Close search" : "Search prayers"}
          >
            <Feather
              name={showSearch ? "x" : "search"}
              size={Math.round(20 * uiScale)}
              color={showSearch ? colors.surface : colors.primary}
            />
          </Pressable>
        </View>
        {showSearch && (
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              {
                marginTop: Math.round(clamp(10 * uiScale, 8, 12)),
                height: searchInputH,
                borderRadius: searchInputRad,
                paddingHorizontal: searchInputPadH,
                fontSize: searchInputFs,
              },
            ]}
            placeholder="Search paths…"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[
              styles.tab,
              { height: tabH, borderRadius: tabRad, paddingHorizontal: Math.round(clamp(10 * uiScale, 8, 12)) },
              activeTab === t.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather
              name={t.icon}
              size={tabIconFs}
              color={activeTab === t.key ? colors.surface : colors.muted}
            />
            <Text
              style={[styles.tabText, { fontSize: tabFs }, activeTab === t.key && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPadBottom, paddingHorizontal: 0 }]}
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
          ) : filteredCategories.length === 0 ? (
            <View style={styles.emptySlots}>
              <Text style={styles.officialEmpty}>No paths match "{searchQuery}"</Text>
            </View>
          ) : (
            <View style={styles.situationGrid}>
              {situationRows.map((row, ri) => (
                <View key={`sit-row-${ri}`} style={[styles.situationRow, { gap: cardGap, marginBottom: cardGap }]}>
                  {row.map((c) => {
                    const key =
                      c.pathId != null && c.pathId > 0
                        ? `p-${c.pathId}`
                        : `c-${"slug" in c && c.slug ? c.slug : c.name}`;
                    return (
                      <View key={key} style={styles.situationCell}>
                        {renderSituationCard(c)}
                      </View>
                    );
                  })}
                </View>
              ))}
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
          paddingHorizontal={0}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPadBottom, paddingHorizontal: 0 }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
  },
  shell: {
    flex: 1,
    width: "100%",
  },
  header: {
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
    minWidth: 0,
    paddingRight: 8,
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
  searchBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchInput: {
    marginTop: 10,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
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
    paddingTop: 4,
  },
  sanctuaryExplainer: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 4,
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
  situationGrid: {},
  situationRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  situationCell: {
    flex: 1,
    minWidth: 0,
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
