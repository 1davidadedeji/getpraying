import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { FeedSearchDraftField } from "@/components/FeedSearchDraftField";
import { SanctuarySlotCard } from "@/components/SanctuarySlotCard";
import { EveningGuideMark, MorningGuideMark } from "@/components/guideIcons/MorningEveningMarks";
import colors from "@/constants/colors";
import { LAYOUT } from "@/constants/layout";
import { useAuth } from "@/context/auth";
import { useFeedNotice } from "@/context/feedNotice";
import { useModerationBadge } from "@/context/moderationBadge";
import { useTabBarVisibility } from "@/context/tabBarVisibility";
import { apiUrl, authHeaders } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { clamp } from "@/lib/responsiveMetrics";

const PAGE_SIZE = 20;
const NEW_POSTS_POLL_MS = 30_000;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const greetSize = Math.round(clamp(17 * uiScale, 15, 21));
  const subGreetSize = Math.round(clamp(13 * uiScale, 12, 15));
  const listBotPad = Math.round(clamp(100 * uiScale, 88, 112));
  const reflIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const heartAv = Math.round(clamp(34 * uiScale, 30, 38));
  const heartAvRad = Math.round(heartAv / 2);
  const heartAvLetterFs = Math.round(clamp(13 * uiScale, 12, 15));
  const heartPrayPadH = Math.round(clamp(16 * uiScale, 14, 18));
  const heartPrayPadV = Math.round(clamp(8 * uiScale, 7, 10));
  const heartPlaceholderFs = Math.round(clamp(14 * uiScale, 13, 16));
  const emptyStateIcon = Math.round(clamp(48 * uiScale, 40, 56));
  const emptyTitleFs = Math.round(clamp(18 * uiScale, 16, 20));
  const emptySubFs = Math.round(clamp(14 * uiScale, 13, 16));
  const { user, token } = useAuth();
  const { feedJumpToTopNonce } = useFeedNotice();
  const { pendingCount: modPending } = useModerationBadge();
  const { onScroll: onScrollHideBar } = useTabBarVisibility();
  const [feedCategory, setFeedCategory] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { feedMediaFocusPostId, onViewableItemsChanged, viewabilityConfig } = useFeedMediaViewability();

  const [newPostCount, setNewPostCount] = useState(0);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const topPostId = useRef<number | null>(null);
  const [sanctuary, setSanctuary] = useState<{
    morning: OfficialPrayerRow | null;
    evening: OfficialPrayerRow | null;
  }>({ morning: null, evening: null });

  /** Last submitted query; drives result facets. Draft typing stays in {@link FeedSearchDraftField}. */
  const [committedSearchQuery, setCommittedSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchUsers, setSearchUsers] = useState<
    { id: number; username: string; displayName?: string | null; avatarUrl?: string | null }[]
  >([]);
  const [searchPosts, setSearchPosts] = useState<Post[]>([]);
  const [feedSearchFacet, setFeedSearchFacet] = useState<"all" | "people" | "prayers">("all");

  const feedSearchFs = Math.round(clamp(15 * uiScale, 14, 17));
  const feedSearchIcon = Math.round(clamp(18 * uiScale, 16, 22));
  const searchClearIcn = Math.round(clamp(20 * uiScale, 18, 24));
  const searchFacetTabH = Math.round(clamp(34 * uiScale, 30, 38));
  const searchFacetTabRad = Math.round(searchFacetTabH / 2);
  const searchFacetGap = Math.round(clamp(8 * uiScale, 6, 10));
  const searchFacetIconFs = Math.round(clamp(16 * uiScale, 14, 18));
  const searchFacetLabelFs = Math.round(clamp(13 * uiScale, 12, 15));
  const searchFacetPadH = Math.round(clamp(10 * uiScale, 8, 12));

  const clearCommittedSearchState = useCallback(() => {
    setCommittedSearchQuery("");
    setSearchUsers([]);
    setSearchPosts([]);
    setFeedSearchFacet("all");
    setSearchLoading(false);
  }, []);

  const fetchSearchResults = useCallback(
    async (q: string) => {
      setSearchLoading(true);
      try {
        const res = await fetch(apiUrl(`/search?${new URLSearchParams({ q })}`), {
          headers: authHeaders(token),
        });
        if (!res.ok) {
          setSearchUsers([]);
          setSearchPosts([]);
          return;
        }
        const data = (await res.json()) as {
          users?: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null }[];
          posts?: Post[];
        };
        setSearchUsers(Array.isArray(data.users) ? data.users : []);
        setSearchPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        setSearchUsers([]);
        setSearchPosts([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [token],
  );

  const runCommittedSearch = useCallback(
    async (qRaw: string, opts?: { dismissKeyboard?: boolean; openModal?: boolean }) => {
      const q = qRaw.trim();
      if (opts?.dismissKeyboard) Keyboard.dismiss();
      if (q.length < 2) {
        clearCommittedSearchState();
        return;
      }
      setCommittedSearchQuery(q);
      setFeedSearchFacet("all");
      if (opts?.openModal !== false) setSearchOpen(true);
      await fetchSearchResults(q);
    },
    [clearCommittedSearchState, fetchSearchResults],
  );

  /** Debounced typing: keep keyboard open, surface results in the modal once there is a real query. */
  const onSearchDraftDebounced = useCallback(
    (draft: string) => {
      const q = draft.trim();
      if (q.length < 2) {
        clearCommittedSearchState();
        return;
      }
      void runCommittedSearch(q, { dismissKeyboard: false, openModal: true });
    },
    [clearCommittedSearchState, runCommittedSearch],
  );

  const loadSanctuary = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/library/official/sanctuary"), {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        morning?: OfficialPrayerRow | null;
        evening?: OfficialPrayerRow | null;
      };
      setSanctuary({
        morning: data.morning ?? null,
        evening: data.evening ?? null,
      });
    } catch {
      /* keep previous sanctuary */
    }
  }, [token]);

  const fetchPage = useCallback(
    async (cursor?: string | null): Promise<{ posts: Post[]; nextCursor: string | null }> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(apiUrl(`/posts?${params}`), {
        headers: authHeaders(token),
      });
      if (!res.ok) return { posts: [], nextCursor: null };
      const data = await res.json();
      const rawNext = data.nextCursor;
      const nc =
        rawNext !== null && rawNext !== undefined && String(rawNext).length > 0 ? String(rawNext) : null;
      return { posts: data.posts ?? [], nextCursor: nc };
    },
    [token],
  );

  const loadFresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const result = await fetchPage();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setError(false);
      if (result.posts.length > 0) {
        topPostId.current = result.posts[0].id;
      }
      setNewPostCount(0);
    } catch {
      if (!opts?.silent) setError(true);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [fetchPage]);

  const loadFreshRef = useRef(loadFresh);
  loadFreshRef.current = loadFresh;

  // Tracks when the jump-to-top nonce last fired so useFocusEffect can
  // skip its own loadFresh call when the nonce already triggered one.
  const lastJumpAtRef = useRef(0);

  useEffect(() => {
    loadFresh();
    void loadSanctuary();
  }, [loadFresh, loadSanctuary]);

  useEffect(() => {
    if (feedJumpToTopNonce === 0) return;
    lastJumpAtRef.current = Date.now();
    setFeedCategory(null);
    setNewPostCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    void loadFreshRef.current({ silent: true });
    void loadSanctuary();
  }, [feedJumpToTopNonce, loadSanctuary]);

  useFocusEffect(
    useCallback(() => {
      // Skip refresh if the jump nonce fired in the last 2 s — it already
      // triggered loadFresh; firing again would be a duplicate round-trip.
      if (Date.now() - lastJumpAtRef.current < 2000) return;
      if (!loading) {
        loadFresh({ silent: true });
        void loadSanctuary();
      }
    }, [loading, loadFresh, loadSanctuary]),
  );

  useEffect(() => {
    if (!token || loading) return;
    const interval = setInterval(async () => {
      if (!topPostId.current) return;
      try {
        const res = await fetch(
          apiUrl(`/posts/new-count?sinceId=${topPostId.current}`),
          { headers: authHeaders(token) },
        );
        if (!res.ok) return;
        const data = await res.json();
        const count = typeof data.count === "number" ? data.count : 0;
        if (count > 0) setNewPostCount(count);
      } catch { /* silent */ }
    }, NEW_POSTS_POLL_MS);
    return () => clearInterval(interval);
  }, [token, loading]);

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: newPostCount > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [newPostCount, pillAnim]);

  const handleNewPostsTap = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNewPostCount(0);
    setFeedCategory(null);
    setRefreshing(true);
    try {
      const result = await fetchPage();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      if (result.posts.length > 0) {
        topPostId.current = result.posts[0].id;
      } else {
        topPostId.current = null;
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setNewPostCount(0);
    try {
      const result = await fetchPage();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      if (result.posts.length > 0) {
        topPostId.current = result.posts[0].id;
      }
      void loadSanctuary();
    } catch { /* keep current data */ } finally {
      setRefreshing(false);
    }
  }, [fetchPage, loadSanctuary]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPage(nextCursor);
      setPosts((prev) => [...prev, ...result.posts]);
      setNextCursor(result.nextCursor);
    } catch { /* silently fail */ } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage]);

  const handleUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleTabPressScroll = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    void loadFresh({ silent: true });
  }, [loadFresh]);

  useTabScrollToTop(handleTabPressScroll);

  const handleScroll = useCallback(
    (event: any) => {
      onScrollHideBar(event);
    },
    [onScrollHideBar],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const displayPosts = useMemo(() => {
    if (!feedCategory) return posts;
    return posts.filter((p) => p.category === feedCategory);
  }, [posts, feedCategory]);

  const categoryLabel = (key: string) =>
    key.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  const isEveningReflection = new Date().getHours() >= 17;
  const showSanctuaryAudio = user?.scheduledNotificationsEnabled !== false;
  const guideSlot: "morning" | "evening" = isEveningReflection ? "evening" : "morning";
  const guideMarkSize = Math.round(clamp(reflIcn * 0.92, 16, 24));

  const renderHeader = () => (
    <View style={{ marginBottom: 8 }}>
      <View style={[styles.feedHeaderToolbar, { paddingTop: topPad + 6 }]}>
        <View style={styles.flex1} />
        <View style={styles.headerRight}>
          {(user?.role === "admin" || user?.role === "moderator") && (
            <Pressable onPress={() => router.push("/admin")} style={styles.adminBtn} accessibilityLabel="Moderation">
              <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
              {modPending > 0 && (
                <View style={styles.modBadge} accessibilityLabel={`${modPending} pending`}>
                  <Text style={styles.modBadgeText}>{modPending > 9 ? "9+" : String(modPending)}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() =>
              user?.username
                ? router.push(`/user/${user.username}` as never)
                : router.push("/(tabs)/profile" as never)
            }
            style={styles.headerAvatarBtn}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(user.avatarUrl)! }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarLetter}>
                  {(user?.displayName?.[0] ?? user?.username?.[0] ?? "?").toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <Text
        style={[styles.greeting, { fontSize: greetSize }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {user?.displayName ? `Hello, ${user.displayName}` : "Get Praying"}
      </Text>
      <Text style={[styles.subGreeting, { fontSize: subGreetSize, marginBottom: 10 }]}>
        Your prayer feed
      </Text>

      <FeedSearchDraftField
        committedQuery={committedSearchQuery}
        onSubmitQuery={(q) => void runCommittedSearch(q, { dismissKeyboard: true, openModal: true })}
        onDebouncedQuery={onSearchDraftDebounced}
        onClearCommitted={clearCommittedSearchState}
        feedSearchFs={feedSearchFs}
        searchIconSize={feedSearchIcon}
        clearIconSize={searchClearIcn}
        placeholder="Search users and prayers…"
        accessibilityLabel="Search feed"
      />

      {showSanctuaryAudio ? (
        <SanctuarySlotCard
          compact
          slot={guideSlot}
          prayer={guideSlot === "evening" ? sanctuary.evening : sanctuary.morning}
          leadingSlotIcon={
            guideSlot === "evening" ? (
              <EveningGuideMark size={guideMarkSize} />
            ) : (
              <MorningGuideMark size={guideMarkSize} />
            )
          }
        />
      ) : null}

      <Pressable
        onPress={() => router.push("/post/new" as never)}
        style={({ pressed }) => [styles.heartRow, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel="Share a prayer"
      >
        {user?.avatarUrl ? (
          <Image
            source={{ uri: resolveMediaUrl(user.avatarUrl)! }}
            style={[styles.heartRowAvatar, { width: heartAv, height: heartAv, borderRadius: heartAvRad }]}
          />
        ) : (
          <View
            style={[
              styles.heartRowAvatarFallback,
              { width: heartAv, height: heartAv, borderRadius: heartAvRad },
            ]}
          >
            <Text style={[styles.heartRowAvatarLetter, { fontSize: heartAvLetterFs }]}>
              {(user?.displayName?.[0] ?? user?.username?.[0] ?? "?").toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.heartPlaceholder, { fontSize: heartPlaceholderFs }]}>What's on your heart?</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/post/new" as never);
          }}
          style={({ pressed }) => [
            styles.heartPrayBtn,
            { paddingHorizontal: heartPrayPadH, paddingVertical: heartPrayPadV },
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Pray"
        >
          <Text style={[styles.heartPrayBtnText, { fontSize: Math.round(clamp(13 * uiScale, 12, 15)) }]}>Pray</Text>
        </Pressable>
      </Pressable>

      {(user?.preferredCategories?.length ?? 0) > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <Pressable
            onPress={() => setFeedCategory(null)}
            style={[styles.pill, feedCategory === null && styles.pillOn]}
          >
            <Text
              style={[styles.pillText, feedCategory === null && styles.pillTextOn]}
              numberOfLines={1}
            >
              All
            </Text>
          </Pressable>
          {user!.preferredCategories!.map((cat: string) => {
            const on = feedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setFeedCategory(on ? null : cat)}
                style={[styles.pill, on && styles.pillOn]}
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>
                  {categoryLabel(cat)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.flame} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  const pillTranslateY = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });
  const pillOpacity = pillAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1],
  });

  return (
    <View style={styles.flex}>
      <FlatList
        ref={listRef}
        data={displayPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onUpdated={handleUpdated}
            feedMediaFocusPostId={feedMediaFocusPostId}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        numColumns={1}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={emptyStateIcon} color={colors.muted} />
              <Text style={[styles.emptyTitle, { fontSize: emptyTitleFs }]}>Connection issue</Text>
              <Text style={[styles.emptySubtitle, { fontSize: emptySubFs }]}>Pull down to try again</Text>
            </View>
          ) : feedCategory && posts.length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={emptyStateIcon} color={colors.muted} />
              <Text style={[styles.emptyTitle, { fontSize: emptyTitleFs }]}>Nothing in this category yet</Text>
              <Text style={[styles.emptySubtitle, { fontSize: emptySubFs }]}>
                Try another filter or pull to refresh
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={emptyStateIcon} color={colors.muted} />
              <Text style={[styles.emptyTitle, { fontSize: emptyTitleFs }]}>No prayers yet</Text>
              <Text style={[styles.emptySubtitle, { fontSize: emptySubFs }]}>Be the first to share a prayer</Text>
            </View>
          )
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: listBotPad,
            paddingHorizontal: gutter,
            maxWidth: LAYOUT.contentMaxWidth,
            width: "100%",
            alignSelf: "center",
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.flame}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Memory management: unmount native view trees (including Video/Audio) for
        // cards that scroll far off-screen. This is the primary defence against OOM
        // during long feed sessions. windowSize=7 keeps 3 screens above + below.
        removeClippedSubviews={Platform.OS !== "web"}
        windowSize={7}
        maxToRenderPerBatch={5}
        initialNumToRender={8}
        updateCellsBatchingPeriod={60}
      />

      {/* "New Posts" floating pill */}
      <Animated.View
        pointerEvents={newPostCount > 0 ? "auto" : "none"}
        style={[
          styles.newPostsPillWrap,
          { top: topPad + 60, transform: [{ translateY: pillTranslateY }], opacity: pillOpacity },
        ]}
      >
        <Pressable
          onPress={() => void handleNewPostsTap()}
          style={({ pressed }) => [styles.newPostsPill, pressed && styles.newPostsPillPressed]}
        >
          <Ionicons name="arrow-up" size={16} color={colors.surface} />
          <Text style={styles.newPostsPillText}>
            {newPostCount >= 99 ? "99+" : newPostCount} new {newPostCount === 1 ? "post" : "posts"}
          </Text>
        </Pressable>
      </Animated.View>

      <Modal visible={searchOpen} animationType="slide" transparent={false}>
        <View style={[styles.flex, styles.searchModal]}>
          <View style={[styles.searchModalToolbar, { paddingTop: Platform.OS === "web" ? 16 : (insets.top || 16) }]}>
            <Pressable
              onPress={() => {
                setFeedSearchFacet("all");
                setSearchOpen(false);
                clearCommittedSearchState();
              }}
              style={styles.searchModalClose}
            >
              <Ionicons name="close" size={28} color={colors.primary} />
            </Pressable>
            <Text style={styles.searchModalTitle}>Search</Text>
            <View style={{ width: 40 }} />
          </View>

          <FeedSearchDraftField
            committedQuery={committedSearchQuery}
            onSubmitQuery={(q) => void runCommittedSearch(q, { dismissKeyboard: true, openModal: true })}
            onDebouncedQuery={onSearchDraftDebounced}
            onClearCommitted={clearCommittedSearchState}
            marginBottom={10}
            feedSearchFs={feedSearchFs}
            searchIconSize={feedSearchIcon}
            clearIconSize={searchClearIcn}
            placeholder="Try a name or phrase from a prayer…"
            autoFocus
            accessibilityLabel="Search query"
          />

          {committedSearchQuery.trim().length >= 2 ? (
            <View
              style={[
                styles.searchFacetRow,
                {
                  gap: searchFacetGap,
                  marginHorizontal: gutter,
                  marginBottom: 10,
                  opacity: searchLoading ? 0.55 : 1,
                },
              ]}
            >
              {(
                [
                  ["all", "All", "layers"] as const,
                  ["people", "People", "users"] as const,
                  ["prayers", "Prayers", "book-open"] as const,
                ]
              ).map(([key, label, icon]) => {
                const active = feedSearchFacet === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFeedSearchFacet(key)}
                    style={[
                      styles.searchFacetTab,
                      {
                        minHeight: searchFacetTabH,
                        borderRadius: searchFacetTabRad,
                        paddingHorizontal: searchFacetPadH,
                        gap: Math.round(clamp(6 * uiScale, 5, 8)),
                      },
                      active && styles.searchFacetTabActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Feather
                      name={icon}
                      size={searchFacetIconFs}
                      color={active ? colors.surface : colors.muted}
                    />
                    <Text
                      style={[
                        styles.searchFacetTabText,
                        { fontSize: searchFacetLabelFs },
                        active && styles.searchFacetTabTextActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {searchLoading ? (
            <View style={{ paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={colors.flame} />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 40 }}
            >
              {(feedSearchFacet === "all" || feedSearchFacet === "people") && (
                <>
                  <Text style={styles.searchSectionLabel}>Users</Text>
                  {searchUsers.length === 0 ? (
                    <Text style={styles.searchEmpty}>No matching users.</Text>
                  ) : (
                    searchUsers.map((u) => (
                      <Pressable
                        key={u.id}
                        style={styles.searchHitRow}
                        onPress={() => {
                          setFeedSearchFacet("all");
                          setSearchOpen(false);
                          router.push(`/user/${u.username}` as never);
                        }}
                      >
                        {u.avatarUrl ? (
                          <Image source={{ uri: resolveMediaUrl(u.avatarUrl)! }} style={styles.searchHitAvatar} />
                        ) : (
                          <View style={styles.searchHitAvatarFall}>
                            <Text style={styles.searchHitLetter}>{(u.displayName ?? u.username)?.[0] ?? "?"}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.searchHitTitle} numberOfLines={1}>
                            {u.displayName ?? u.username}
                          </Text>
                          <Text style={styles.searchHitSub} numberOfLines={1}>
                            @{u.username}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </>
              )}

              {(feedSearchFacet === "all" || feedSearchFacet === "prayers") && (
                <>
                  <Text style={[styles.searchSectionLabel, { marginTop: feedSearchFacet === "all" ? 24 : 0 }]}>
                    Prayers
                  </Text>
                  {searchPosts.length === 0 ? (
                    <Text style={styles.searchEmpty}>No matching prayers.</Text>
                  ) : (
                    searchPosts.map((sp) => (
                      <Pressable
                        key={sp.id}
                        style={styles.searchHitRowPrayer}
                        onPress={() => {
                          setFeedSearchFacet("all");
                          setSearchOpen(false);
                          router.push(`/post/${sp.id}` as never);
                        }}
                      >
                        <Text style={styles.searchPrayerPreview} numberOfLines={3}>
                          {sp.content}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex1: { flex: 1 },
  feedHeaderToolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
  },
  searchModal: {
    backgroundColor: colors.cream,
  },
  searchModalToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchModalClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchModalTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: colors.primary,
  },
  searchFacetRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  searchFacetTab: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchFacetTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchFacetTabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  searchFacetTabTextActive: {
    color: colors.surface,
  },
  searchSectionLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  searchEmpty: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
  },
  searchHitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchHitAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchHitAvatarFall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHitLetter: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.accent,
  },
  searchHitTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  searchHitSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  searchHitRowPrayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchPrayerPreview: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 16,
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  subGreeting: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  modBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  modBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: colors.surface,
  },
  headerAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerAvatarImg: {
    width: "100%",
    height: "100%",
  },
  headerAvatarFallback: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarLetter: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.accent,
  },
  heartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heartRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  heartRowAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heartRowAvatarLetter: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.accent,
  },
  heartPlaceholder: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
  heartPrayBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heartPrayBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.surface,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  pillTextOn: {
    color: colors.surface,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
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
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  newPostsPillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  newPostsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  newPostsPillPressed: {
    opacity: 0.88,
  },
  newPostsPillText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
  },
});
