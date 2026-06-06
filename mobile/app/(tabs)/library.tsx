import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { SanctuarySlotCard } from "@/components/SanctuarySlotCard";
import { EveningGuideMark, MorningGuideMark } from "@/components/guideIcons/MorningEveningMarks";
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
import PostCard from "@/components/PostCard";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { FEATHER_ICON_MAP } from "@/constants/featherIconMap";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { fetchLibraryCached, peekLibraryCache } from "@/lib/libraryFetchCache";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import { isEveningSanctuarySlotNow } from "@/lib/localClock";
import * as RM from "@/lib/responsiveMetrics";
import { SAVED_OFFICIAL_EMPTY } from "@/constants/savedOfficialList";
import {
  LIBRARY_FALLBACK_PATHS,
  type ApiLibraryCategory,
  emojiForLibraryCategory,
  type LibraryPathCard,
} from "@/constants/libraryFallbackPaths";

type Tab = "categories" | "saved";
type CategoryItem = LibraryPathCard | ApiLibraryCategory;

type LectureCarouselItem = OfficialPrayerRow | { _explorePlaceholder: true };

/** Solid card themes rotating through the carousel (match reference: blue / tan / navy). */
const LECTURE_VISUAL_THEMES = [
  {
    bg: "#E8F0FA",
    titleColor: "#1A1F36",
    subColor: "rgba(26,31,54,0.68)",
    iconBg: "rgba(255,255,255,0.82)",
    iconColor: "#1A1F36",
    chevronBg: "#FFFFFF",
    chevronColor: "#1A1F36",
  },
  {
    bg: "#EDE4D9",
    titleColor: "#3D3429",
    subColor: "rgba(61,52,41,0.72)",
    iconBg: "rgba(255,255,255,0.75)",
    iconColor: "#5C4A3A",
    chevronBg: "#FFFFFF",
    chevronColor: "#5C4A3A",
  },
  {
    bg: "#1E2D4A",
    titleColor: "#FFFFFF",
    subColor: "rgba(255,255,255,0.76)",
    iconBg: "rgba(255,255,255,0.14)",
    iconColor: "#FFFFFF",
    chevronBg: "#FFFFFF",
    chevronColor: "#1E2D4A",
  },
] as const;

const LECTURE_ARTWORK_ICONS = ["book-outline", "sunny-outline", "mic-outline"] as const;

function truncateLecturePreview(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const focusSection =
    sectionParam === "morning" || sectionParam === "evening" ? sectionParam : null;
  const { windowWidth, windowHeight, gutter, uiScale } = useResponsiveLayout();
  const { token } = useAuth();
  const categoriesScrollRef = useRef<ScrollView>(null);
  const sanctuarySectionY = useRef(0);
  const savedListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<CategoryItem[]>(LIBRARY_FALLBACK_PATHS);
  const [loadingCats, setLoadingCats] = useState(false);
  const [sanctuary, setSanctuary] = useState<{
    morning: OfficialPrayerRow | null;
    evening: OfficialPrayerRow | null;
  }>({ morning: null, evening: null });
  const [loadingOfficial, setLoadingOfficial] = useState(false);
  const [lecturesGuides, setLecturesGuides] = useState<OfficialPrayerRow[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [savedOfficialIds, setSavedOfficialIds] = useState<Set<number>>(new Set());
  const [savedOfficialList, setSavedOfficialList] = useState<OfficialPrayerRow[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const queryClient = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const [lectureScrollIndex, setLectureScrollIndex] = useState(0);

  const lectureCarouselData = useMemo<LectureCarouselItem[]>(() => {
    if (lecturesGuides.length === 0) return [];
    return [...lecturesGuides, { _explorePlaceholder: true }];
  }, [lecturesGuides]);

  const savedListData = useMemo(
    () =>
      loadingSaved
        ? []
        : [
            ...savedOfficialList.map((op) => ({
              type: "official" as const,
              id: `o-${op.id}`,
              item: op,
            })),
            ...savedPosts.map((p) => ({
              type: "post" as const,
              id: `p-${p.id}`,
              item: p,
            })),
          ],
    [loadingSaved, savedOfficialList, savedPosts],
  );

  useEffect(() => {
    setLectureScrollIndex(0);
  }, [lecturesGuides]);

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

  const loadSavedOfficialIds = useCallback(async (opts?: { force?: boolean }) => {
    if (!token) {
      setSavedOfficialIds(new Set());
      return;
    }
    const path = "/library/saved-official";
    const cached = peekLibraryCache<{ prayers?: OfficialPrayerRow[] }>(path, token);
    if (cached?.prayers) {
      setSavedOfficialIds(new Set(cached.prayers.map((p) => p.id)));
    }
    try {
      const data = await fetchLibraryCached<{ prayers?: OfficialPrayerRow[] }>(path, token, opts);
      const prayers = data?.prayers ?? [];
      setSavedOfficialIds(new Set(prayers.map((p) => p.id)));
    } catch {
      /* silent */
    }
  }, [token]);

  const loadSaved = useCallback(async () => {
    if (!token) {
      setSavedOfficialList([]);
      setSavedPosts([]);
      return;
    }
    setLoadingSaved(true);
    try {
      const [officialRes, postsRes] = await Promise.all([
        apiFetch("/library/saved-official", { token }),
        apiFetch("/library/saved", { token }),
      ]);
      if (officialRes.ok) {
        const data = await officialRes.json();
        setSavedOfficialList((data as { prayers?: OfficialPrayerRow[] }).prayers ?? []);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setSavedPosts((data as { posts?: Post[] }).posts ?? []);
        queryClient.setQueryData(getGetSavedPrayersQueryKey(), data);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingSaved(false);
    }
  }, [token, queryClient]);

  const loadCategories = useCallback(async (opts?: { force?: boolean }) => {
    const cached = peekLibraryCache<ApiLibraryCategory[]>("/library/categories", token);
    if (cached?.length) setCategories(cached);
    if (!cached?.length) setLoadingCats(true);
    try {
      const data = await fetchLibraryCached<ApiLibraryCategory[] | unknown>(
        "/library/categories",
        token,
        opts,
      );
      const apiList = Array.isArray(data) ? (data as ApiLibraryCategory[]) : [];
      setCategories(apiList.length > 0 ? apiList : LIBRARY_FALLBACK_PATHS);
    } catch {
      if (!cached?.length) setCategories(LIBRARY_FALLBACK_PATHS);
    } finally {
      setLoadingCats(false);
    }
  }, [token]);

  const loadSanctuary = useCallback(async (opts?: { force?: boolean }) => {
    type SanctuaryPayload = {
      morning?: OfficialPrayerRow | null;
      evening?: OfficialPrayerRow | null;
    };
    const path = "/library/official/sanctuary";
    const cached = peekLibraryCache<SanctuaryPayload>(path, token);
    if (cached) {
      setSanctuary({
        morning: cached.morning ?? null,
        evening: cached.evening ?? null,
      });
    }
    if (!cached) setLoadingOfficial(true);
    try {
      const data = await fetchLibraryCached<SanctuaryPayload>(path, token, opts);
      if (data) {
        setSanctuary({
          morning: data.morning ?? null,
          evening: data.evening ?? null,
        });
      }
    } catch {
      if (!cached) setSanctuary({ morning: null, evening: null });
    } finally {
      setLoadingOfficial(false);
    }
  }, [token]);

  const loadLectures = useCallback(async (opts?: { force?: boolean }) => {
    const path = "/library/official?category=lectures&limit=20";
    const cached = peekLibraryCache<{ prayers?: OfficialPrayerRow[] }>(path, token);
    if (cached?.prayers) setLecturesGuides(cached.prayers);
    if (!cached?.prayers?.length) setLoadingLectures(true);
    try {
      const data = await fetchLibraryCached<{ prayers?: OfficialPrayerRow[] }>(path, token, opts);
      setLecturesGuides(data?.prayers ?? []);
    } catch {
      if (!cached?.prayers) setLecturesGuides([]);
    } finally {
      setLoadingLectures(false);
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
        const res = await apiFetch(`/library/saved-official/${id}`, {
          method: wasSaved ? "DELETE" : "POST",
          token,
        });
        if (!res.ok) {
          // Revert on failure
          setSavedOfficialIds((prev) => {
            const next = new Set(prev);
            if (wasSaved) next.add(id);
            else next.delete(id);
            return next;
          });
        } else if (activeTab === "saved") {
          void loadSaved();
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
    [token, savedOfficialIds, activeTab, loadSaved],
  );

  useFocusEffect(
    useCallback(() => {
      void loadCategories();
      void loadSanctuary();
      void loadSavedOfficialIds();
      void loadSaved();
      void loadLectures();
      if (focusSection && categoriesScrollRef.current) {
        requestAnimationFrame(() => {
          categoriesScrollRef.current?.scrollTo({
            y: Math.max(0, sanctuarySectionY.current - 12),
            animated: true,
          });
        });
      }
    }, [loadCategories, loadSanctuary, loadSavedOfficialIds, loadSaved, loadLectures, focusSection]),
  );

  useEffect(() => {
    if (activeTab === "categories") {
      void loadCategories();
      void loadSanctuary();
      void loadSavedOfficialIds();
      void loadLectures();
    } else if (activeTab === "saved") {
      void loadSaved();
    }
  }, [activeTab, loadCategories, loadSanctuary, loadSavedOfficialIds, loadSaved, loadLectures]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const SITUATION_COLS = useMemo(
    () =>
      RM.getLibrarySituationCols(
        windowWidth,
        windowHeight,
        windowWidth >= LAYOUT.tabletMinWidth,
      ),
    [windowWidth, windowHeight],
  );
  const cardGap = Math.round(10 * uiScale);
  const situationRows = useMemo(() => {
    const rows: CategoryItem[][] = [];
    for (let i = 0; i < filteredCategories.length; i += SITUATION_COLS) {
      rows.push(filteredCategories.slice(i, i + SITUATION_COLS));
    }
    return rows;
  }, [filteredCategories, SITUATION_COLS]);
  const situationIconSize = Math.round(20 * uiScale);
  const situationIconBg = useMemo(() => RM.getLibraryIconBgSize(uiScale), [uiScale]);
  const situationEmojiSize = Math.round(RM.clamp(26 * uiScale, 24, 30));
  const lectureCarouselGap = Math.round(10 * uiScale);
  const lectureCardWidth = Math.round(
    RM.clamp(
      Math.min(windowWidth, LAYOUT.contentMaxWidth) - gutter * 2 - lectureCarouselGap,
      200,
      258,
    ),
  );
  const lectureSnapInterval = lectureCardWidth + lectureCarouselGap;
  const scrollPadBottom = Math.round(RM.clamp(100 * uiScale, 88, 112)) + insets.bottom;
  const searchBtnSz = Math.round(RM.clamp(40 * uiScale, 36, 46));
  const searchBtnRad = Math.round(searchBtnSz / 2);
  const searchHitSlop = Math.round(RM.clamp(8 * uiScale, 6, 10));
  const searchInputH = Math.round(RM.clamp(40 * uiScale, 36, 44));
  const searchInputPadH = Math.round(RM.clamp(16 * uiScale, 12, 18));
  const searchInputRad = Math.round(RM.clamp(20 * uiScale, 16, 22));
  const searchInputFs = Math.round(RM.clamp(14 * uiScale, 13, 15));
  const tabIconFs = Math.round(RM.clamp(13 * uiScale, 12, 15));
  const tabFs = Math.round(RM.clamp(13 * uiScale, 12, 15));
  const tabH = Math.round(RM.clamp(34 * uiScale, 30, 38));
  const tabRad = Math.round(tabH / 2);
  const sanctuaryLeadSz = Math.round(RM.clamp(40 * uiScale, 34, 48));

  const tabs: { key: Tab; label: string; icon: "book-open" | "bookmark" }[] = [
    { key: "categories", label: "Official Prayers", icon: "book-open" },
    { key: "saved", label: "Saved", icon: "bookmark" },
  ];

  const onLectureScrollSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const step = lectureSnapInterval;
      if (step <= 0 || lectureCarouselData.length === 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const ix = Math.round(x / step);
      setLectureScrollIndex(Math.max(0, Math.min(ix, lectureCarouselData.length - 1)));
    },
    [lectureSnapInterval, lectureCarouselData.length],
  );

  const openOfficialPrayer = useCallback(
    (id: number) => {
      void fetchLibraryCached(`/library/official/${id}`, token, { force: true });
      router.push(`/official/${id}` as never);
    },
    [token],
  );

  const renderLectureCarouselItem = useCallback(
    (info: ListRenderItemInfo<LectureCarouselItem>) => {
      const { item } = info;
      if (!("id" in item)) {
        return (
          <View style={[styles.lectureCardTall, { width: lectureCardWidth }, styles.lectureExploreCard]}>
            <View style={[styles.lectureIconOrb, styles.lectureExploreIconOrb]}>
              <Ionicons name="ellipsis-horizontal" size={Math.round(22 * uiScale)} color={colors.muted} />
            </View>
            <Text style={styles.lectureExploreTitle} numberOfLines={2}>
              Explore More
            </Text>
            <Text style={styles.lectureExploreSub} numberOfLines={2}>
              More lectures coming soon.
            </Text>
          </View>
        );
      }

      const op = item;
      const lectureIx = lecturesGuides.findIndex((g) => g.id === op.id);
      const themeIx =
        lectureIx >= 0 ? lectureIx % LECTURE_VISUAL_THEMES.length : 0;
      const theme = LECTURE_VISUAL_THEMES[themeIx];
      const artIx = lectureIx >= 0 ? lectureIx % LECTURE_ARTWORK_ICONS.length : 0;

      const sub = truncateLecturePreview(
        (op.subtitle?.trim() ?? op.content?.trim() ?? "").trim() || "Listen to this guide.",
        100,
      );

      return (
        <Pressable
          style={({ pressed }) => [
            styles.lectureCardTall,
            {
              width: lectureCardWidth,
              backgroundColor: theme.bg,
            },
            pressed && styles.cardPressed,
          ]}
          onPress={() => openOfficialPrayer(op.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open lecture: ${op.title}`}
        >
          <View style={[styles.lectureIconOrb, { backgroundColor: theme.iconBg }]}>
            <Ionicons
              name={LECTURE_ARTWORK_ICONS[artIx]}
              size={Math.round(26 * uiScale)}
              color={theme.iconColor}
            />
          </View>
          <Text style={[styles.lectureCardTitleSerif, { color: theme.titleColor }]} numberOfLines={2}>
            {op.title}
          </Text>
          <Text style={[styles.lectureCardSubSans, { color: theme.subColor }]} numberOfLines={4}>
            {sub}
          </Text>
          <View
            pointerEvents="none"
            style={[
              styles.lectureChevronFab,
              { bottom: Math.round(14 * uiScale), right: Math.round(14 * uiScale), backgroundColor: theme.chevronBg },
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={Math.round(17 * uiScale)}
              color={theme.chevronColor}
            />
          </View>
        </Pressable>
      );
    },
    [lectureCardWidth, lecturesGuides, uiScale, openOfficialPrayer],
  );

  const openPath = (cat: CategoryItem) => {
    if (cat.pathId != null && cat.pathId > 0) {
      router.push(`/path/${cat.pathId}` as never);
    } else {
      const slug =
        "slug" in cat && cat.slug
          ? cat.slug
          : "category" in cat && cat.category
            ? cat.category
            : cat.name
                .toLowerCase()
                .replace(/[^a-z0-9/]+/g, "-")
                .replace(/^-|-$/g, "");
      const params = new URLSearchParams({
        category: slug,
        excludeScheduled: "1",
        limit: "120",
      });
      void fetchLibraryCached(`/library/official?${params}`, token, { force: true });
      router.push(`/category/${encodeURIComponent(slug)}` as never);
    }
  };

  const renderSituationCard = (cat: CategoryItem) => {
    const emojiChar = emojiForLibraryCategory(cat);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.situationCard,
          { width: "100%" },
          pressed && styles.cardPressed,
        ]}
        onPress={() => openPath(cat)}
        accessibilityRole="button"
        accessibilityLabel={`Browse ${cat.name}`}
      >
        {emojiChar ? (
          <View style={styles.situationIconSlot}>
            <Text style={[styles.situationEmoji, { fontSize: situationEmojiSize }]} allowFontScaling>
              {emojiChar}
            </Text>
          </View>
        ) : (
          <View style={styles.situationIconSlot}>
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
          </View>
        )}
        <Text style={styles.situationName} numberOfLines={2} ellipsizeMode="tail">
          {cat.name}
        </Text>
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
                marginTop: Math.round(RM.clamp(10 * uiScale, 8, 12)),
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
              { height: tabH, borderRadius: tabRad, paddingHorizontal: Math.round(RM.clamp(10 * uiScale, 8, 12)) },
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
          style={styles.tabScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPadBottom, paddingHorizontal: 0 }]}
        >
          
          {/* Official prayer for current time of day (same rule as home) */}
          <View
            onLayout={(e) => {
              sanctuarySectionY.current = e.nativeEvent.layout.y;
            }}
          >
          {loadingOfficial ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : !sanctuary.morning && !sanctuary.evening ? (
            <View style={styles.emptySlots}>
              <Ionicons name="book-outline" size={36} color={colors.muted} />
              <Text style={styles.officialEmpty}>
                Morning and evening official prayer guides will appear here.
              </Text>
            </View>
          ) : (() => {
            const eveningNow = focusSection ? focusSection === "evening" : isEveningSanctuarySlotNow();
            const active = eveningNow ? sanctuary.evening : sanctuary.morning;
            if (!active) {
              return (
                <View style={styles.emptySlots}>
                  <Ionicons name="time-outline" size={36} color={colors.muted} />
                  <Text style={styles.officialEmpty}>
                    {eveningNow
                      ? "The evening official prayer will appear here when it’s available."
                      : "The morning official prayer will appear here when it’s available."}
                  </Text>
                </View>
              );
            }
            return eveningNow ? (
              <SanctuarySlotCard
                slot="evening"
                prayer={active}
                leadingSlotIcon={<EveningGuideMark size={sanctuaryLeadSz} />}
                showSave={!!token}
                isSaved={savedOfficialIds.has(active.id)}
                onToggleSave={() => void toggleSaveOfficial(active.id)}
              />
            ) : (
              <SanctuarySlotCard
                slot="morning"
                prayer={active}
                leadingSlotIcon={<MorningGuideMark size={sanctuaryLeadSz} />}
                showSave={!!token}
                isSaved={savedOfficialIds.has(active.id)}
                onToggleSave={() => void toggleSaveOfficial(active.id)}
              />
            );
          })()}
          </View>

          {/* Lectures */}
          {(loadingLectures || lecturesGuides.length > 0) && (
            <>
              <View style={[styles.lecturesHeaderBlock, { marginTop: 24, marginBottom: 12 }]}>
                <View>
                  <Text style={styles.lecturesKicker}>LECTURES</Text>
                  <Text style={styles.lecturesSubhead}>Deepen your prayer life</Text>
                </View>
                <Feather name="headphones" size={Math.round(22 * uiScale)} color={colors.primary} />
              </View>
              {loadingLectures ? (
                <ActivityIndicator color={colors.accent} style={styles.loader} />
              ) : (
                <>
                  <FlatList
                    horizontal
                    nestedScrollEnabled
                    data={lectureCarouselData}
                    keyExtractor={(it) =>
                      !("id" in it) ? "__explore_more" : String((it as OfficialPrayerRow).id)}
                    renderItem={renderLectureCarouselItem}
                    ItemSeparatorComponent={() => <View style={{ width: lectureCarouselGap }} />}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 12, paddingRight: 4 }}
                    snapToInterval={lectureSnapInterval}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    onMomentumScrollEnd={onLectureScrollSettle}
                    style={{ overflow: "visible" }}
                  />
                  {lectureCarouselData.length > 1 ? (
                    <View style={styles.lectureDotRow}>
                      {lectureCarouselData.map((_, i) => (
                        <View
                          key={`lect-dot-${i}`}
                          style={[
                            styles.lectureDot,
                            i === lectureScrollIndex && styles.lectureDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              )}
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

      {/* Saved Tab — combined official guides + feed posts */}
      {activeTab === "saved" && (
        <FlatList
          ref={savedListRef}
          style={styles.tabScroll}
          data={savedListData}
          keyExtractor={(row) => row.id}
          renderItem={({ item: row }) => {
            if (row.type === "official") {
              const op = row.item as OfficialPrayerRow;
              return (
                <View style={{ paddingHorizontal: 0 }}>
                  <OfficialGuideCard
                    op={op}
                    showSave
                    isSaved
                    onToggleSave={async () => {
                      if (!token) return;
                      setSavedOfficialList((prev) => prev.filter((p) => p.id !== op.id));
                      setSavedOfficialIds((prev) => { const next = new Set(prev); next.delete(op.id); return next; });
                      await apiFetch(`/library/saved-official/${op.id}`, { method: "DELETE", token }).catch(() => void loadSaved());
                    }}
                  />
                </View>
              );
            }
            const p = row.item as Post;
            return (
              <PostCard
                post={p}
                onUpdated={(updated) => setSavedPosts((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              />
            );
          }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPadBottom, paddingHorizontal: 0 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loadingSaved ? (
              <ActivityIndicator color={colors.accent} style={styles.loader} />
            ) : (
              <View style={[styles.emptySlots, { paddingTop: 40 }]}>
                <Ionicons name="bookmark-outline" size={40} color={colors.muted} />
                <Text style={styles.officialEmpty}>{SAVED_OFFICIAL_EMPTY.title}</Text>
                <Text style={[styles.officialEmpty, { fontSize: 12 }]}>{SAVED_OFFICIAL_EMPTY.subtitle}</Text>
              </View>
            )
          }
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
    maxWidth: LAYOUT.contentMaxWidth,
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
  tabScroll: {
    flex: 1,
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
    height: 120,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  situationIconSlot: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  situationEmoji: {
    textAlign: "center",
  },
  situationName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    textAlign: "center",
    height: 32,
    width: "100%",
  },
  lecturesHeaderBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  lecturesKicker: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  lecturesSubhead: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  lectureCardTall: {
    minHeight: 172,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
    alignItems: "center",
    position: "relative",
    overflow: "visible",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lectureExploreCard: {
    backgroundColor: "#F0EEE8",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  lectureIconOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  lectureExploreIconOrb: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lectureCardTitleSerif: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
    width: "100%",
  },
  lectureCardSubSans: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    width: "100%",
  },
  lectureChevronFab: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  lectureExploreTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: colors.text,
    textAlign: "center",
    width: "100%",
  },
  lectureExploreSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    width: "100%",
  },
  lectureDotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  lectureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  lectureDotActive: {
    backgroundColor: colors.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
