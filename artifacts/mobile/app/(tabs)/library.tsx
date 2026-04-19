import { Feather } from "@expo/vector-icons";
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
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
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

const PATH_CARD_H_WIDTH = 132;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const categoriesScrollRef = useRef<ScrollView>(null);
  const savedListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<CategoryItem[]>(LIBRARY_FALLBACK_PATHS);
  const [pathsExpanded, setPathsExpanded] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);
  const [officialPrayers, setOfficialPrayers] = useState<OfficialPrayerRow[]>([]);
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

  const loadOfficial = useCallback(async () => {
    setLoadingOfficial(true);
    try {
      const res = await fetch(apiUrl("/library/official?limit=30&excludeScheduled=1"), {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        const list = (data as { prayers?: OfficialPrayerRow[] }).prayers;
        setOfficialPrayers(Array.isArray(list) ? list : []);
      }
    } catch {
      setOfficialPrayers([]);
    } finally {
      setLoadingOfficial(false);
    }
  }, [token]);

  const toggleSaveOfficial = useCallback(
    async (id: number) => {
      if (!token) return;
      const next = !savedOfficialIds.has(id);
      const method = next ? "POST" : "DELETE";
      const res = await fetch(apiUrl(`/library/saved-official/${id}`), {
        method,
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      setSavedOfficialIds((prev) => {
        const n = new Set(prev);
        if (next) n.add(id);
        else n.delete(id);
        return n;
      });
    },
    [token, savedOfficialIds],
  );

  useEffect(() => {
    if (activeTab === "categories") {
      void loadCategories();
      void loadOfficial();
      void loadSavedOfficialIds();
    }
  }, [activeTab, loadCategories, loadOfficial, loadSavedOfficialIds]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const screenWidth = Dimensions.get("window").width;
  const isTablet = screenWidth >= 768;
  const numColumns = isTablet ? 3 : 2;
  const cardGap = 10;
  const horizontalPad = 16;
  const totalGaps = (numColumns - 1) * cardGap;
  const cardWidth = (screenWidth - horizontalPad * 2 - totalGaps) / numColumns;

  const tabs: { key: Tab; label: string; icon: "grid" | "bookmark" }[] = [
    { key: "categories", label: "Paths", icon: "grid" },
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

  const renderPathCard = (cat: CategoryItem, compact: boolean) => (
    <Pressable
      key={cat.pathId != null && cat.pathId > 0 ? `p-${cat.pathId}` : `c-${"slug" in cat && cat.slug ? cat.slug : cat.name}`}
      style={({ pressed }) => [
        compact ? styles.catCardH : styles.catCard,
        !compact && { width: cardWidth },
        compact && { width: PATH_CARD_H_WIDTH },
        pressed && styles.catCardPressed,
      ]}
      onPress={() => openPath(cat)}
    >
      <View style={styles.catIconBg}>
        <Feather
          name={(FEATHER_ICON_MAP[cat.icon] ?? "star") as any}
          size={22}
          color={colors.surface}
        />
      </View>
      <Text style={styles.catName} numberOfLines={2}>
        {cat.name}
      </Text>
      <Text style={styles.catCount}>{cat.count} guides</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Prayer Library</Text>
        <Text style={styles.subtitle}>Curated for your walk</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather
              name={t.icon}
              size={14}
              color={activeTab === t.key ? colors.surface : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "categories" && (
        <ScrollView
          ref={categoriesScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Explore Paths</Text>
            {categories.length > 0 ? (
              <Pressable onPress={() => setPathsExpanded((e) => !e)} hitSlop={8}>
                <Text style={styles.seeAll}>{pathsExpanded ? "Show less" : "See all"}</Text>
              </Pressable>
            ) : null}
          </View>
          {loadingCats ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : pathsExpanded ? (
            <View style={styles.catGrid}>{categories.map((c) => renderPathCard(c, false))}</View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pathsRow}
            >
              {categories.map((c) => renderPathCard(c, true))}
            </ScrollView>
          )}

          <View style={[styles.sectionHeaderRow, styles.sectionSpacer]}>
            <Text style={styles.sectionHeading}>Official Guides</Text>
          </View>
          {loadingOfficial ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : officialPrayers.length === 0 ? (
            <Text style={styles.officialEmpty}>Guides from your community team will appear here.</Text>
          ) : (
            officialPrayers.map((op) => (
              <OfficialGuideCard
                key={op.id}
                op={op}
                showSave={!!token}
                isSaved={savedOfficialIds.has(op.id)}
                onToggleSave={() => void toggleSaveOfficial(op.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "saved" && (
        <SavedOfficialPrayersList
          listRef={savedListRef}
          queryEnabled
          invalidateOnFocus
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
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
    paddingTop: 8,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
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
    marginBottom: 10,
  },
  sectionSpacer: {
    marginTop: 28,
  },
  sectionHeading: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  seeAll: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  officialEmpty: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
  },
  loader: {
    marginTop: 40,
  },
  pathsEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  pathsEmptyText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  pathsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catCardH: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catCardPressed: {
    opacity: 0.85,
  },
  catIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
  },
  catCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
});
