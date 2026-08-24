import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { useTabBarVisibility } from "@/context/tabBarVisibility";
import { apiFetch } from "@/lib/api";
import { apiFetchGetOnce } from "@/lib/inFlightGet";
import {
  DEFAULT_FOCUS_FETCH_THROTTLE_MS,
  runFeedFocusFetch,
  shouldRunThrottledFocusFetch,
} from "@/lib/focusFetchThrottle";
import { fetchLibraryCached, peekLibraryCache } from "@/lib/libraryFetchCache";
import { loadSanctuaryState } from "@/lib/sanctuaryLoad";
import { sanctuaryLibraryPath } from "@/lib/sanctuarySchedule";
import { subscribeSanctuaryRefresh } from "@/lib/sanctuaryRefresh";
import { pickFeedWatermarkIso } from "@/lib/feedWatermark";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { usePauseMediaOnBlur } from "@/hooks/usePauseMediaOnBlur";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { clamp } from "@/lib/responsiveMetrics";
import { isEveningSanctuarySlotNow } from "@/lib/localClock";
import { subscribeAppActive } from "@/lib/appResume";
import { applyEngagementPatch, filterRemovedPost, filterPostsByAuthorUsername, subscribePostEngagement, subscribePostRemoved, subscribeUserBlocked } from "@/lib/postEngagementSync";

const PAGE_SIZE = 20;
const NEW_POSTS_POLL_MS = 45_000;
/** Show the “new prayers” pill once the user has scrolled slightly (avoids flash on first paint). */
const NEW_POSTS_SCROLL_GATE_PX = 0;
const NEW_POSTS_COUNT_DEBOUNCE_MS = 550;
/** iOS scroll proximity fallback — FlatList onEndReached is unreliable with variable-height cells. */
const LOAD_MORE_SCROLL_PADDING_PX = 360;

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
  const { onScroll: onScrollHideBar } = useTabBarVisibility();
  const [feedCategory, setFeedCategory] = useState<string | null>(null);
  const feedCategoryRef = useRef<string | null>(null);
  feedCategoryRef.current = feedCategory;
  /** Bumped on category change and each fresh fetch — stale responses are ignored. */
  const feedFetchGenerationRef = useRef(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Refs kept in sync with their state counterparts so callbacks never close over
  // a stale value — avoids the race where onEndReached fires multiple times before
  // setLoadingMore/setNextCursor are processed by React.
  const nextCursorRef = useRef<string | null>(null);
  nextCursorRef.current = nextCursor;
  const loadingMoreRef = useRef(false);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  // Timestamp of the last successful full-page refresh — used to suppress silent
  // auto-refreshes that would discard the user's scroll position.
  const lastFreshAtRef = useRef<number>(0);
  /** Current list scroll offset — resume refresh only when near the top. */
  const feedScrollYRef = useRef(0);
  const [error, setError] = useState(false);
  const listRef = useRef<FlatList>(null);
  const {
    feedMediaFocusPostId,
    onViewableItemsChanged,
    viewabilityConfig,
    clearFeedMediaFocus,
  } = useFeedMediaViewability();
  usePauseMediaOnBlur(clearFeedMediaFocus);

  const [newPostCount, setNewPostCount] = useState(0);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const newPostsCountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newPostsScrollGateRef = useRef(false);
  const [newPostsScrollGate, setNewPostsScrollGate] = useState(false);
  /** Server watermark from GET `/posts` — see GET `/posts/new-count?maxKnownCreatedAt`. */
  const maxKnownCreatedAtRef = useRef<string | null>(null);

  const applyFeedWatermark = useCallback((globalNewestCreatedAt: string | null | undefined) => {
    const iso = pickFeedWatermarkIso(globalNewestCreatedAt);
    if (iso) maxKnownCreatedAtRef.current = iso;
  }, []);
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
  const searchRequestIdRef = useRef(0);
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
    searchRequestIdRef.current += 1;
    setCommittedSearchQuery("");
    setSearchUsers([]);
    setSearchPosts([]);
    setFeedSearchFacet("all");
    setSearchLoading(false);
  }, []);

  const fetchSearchResults = useCallback(
    async (q: string) => {
      const requestId = ++searchRequestIdRef.current;
      setSearchLoading(true);
      try {
        const res = await apiFetch(`/search?${new URLSearchParams({ q })}`, { token });
        if (requestId !== searchRequestIdRef.current) return;
        if (!res.ok) {
          setSearchUsers([]);
          setSearchPosts([]);
          return;
        }
        const data = (await res.json()) as {
          users?: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null }[];
          posts?: Post[];
        };
        if (requestId !== searchRequestIdRef.current) return;
        setSearchUsers(Array.isArray(data.users) ? data.users : []);
        setSearchPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchUsers([]);
        setSearchPosts([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
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

  const onFeedSearchSubmit = useCallback(
    (q: string) => void runCommittedSearch(q, { dismissKeyboard: true, openModal: true }),
    [runCommittedSearch],
  );

  /** Debounced search inside the full-screen modal only (never auto-open modal from the feed bar — it steals focus). */
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

  const loadSanctuary = useCallback(async (opts?: { force?: boolean }) => {
    const path = sanctuaryLibraryPath();
    type SanctuaryPayload = {
      morning?: OfficialPrayerRow | null;
      evening?: OfficialPrayerRow | null;
    };
    const cached = peekLibraryCache<SanctuaryPayload>(path, token);
    if (cached) {
      setSanctuary({
        morning: cached.morning ?? null,
        evening: cached.evening ?? null,
      });
    }
    try {
      const data = await loadSanctuaryState(token, opts);
      if (data) setSanctuary(data);
    } catch {
      /* keep previous sanctuary */
    }
  }, [token]);

  const fetchPage = useCallback(
    async (
      cursor?: string | null,
      category?: string | null,
    ): Promise<{ posts: Post[]; nextCursor: string | null; globalNewestCreatedAt: string | null }> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      if (category) params.set("category", category);
      if (token) params.set("personalize", "true");

      const res = await apiFetchGetOnce(`/posts?${params}`, { token });
      if (!res.ok) throw new Error(`GET /posts failed: ${res.status}`);
      const data = await res.json();
      const rawNext = data.nextCursor;
      const nc =
        rawNext !== null && rawNext !== undefined && String(rawNext).length > 0 ? String(rawNext) : null;
      const globalNewestCreatedAt =
        typeof data.globalNewestCreatedAt === "string" ? data.globalNewestCreatedAt : null;
      return { posts: data.posts ?? [], nextCursor: nc, globalNewestCreatedAt };
    },
    [token],
  );

  const loadFresh = useCallback(async (opts?: { silent?: boolean; category?: string | null }) => {
    const category = opts?.category !== undefined ? opts.category : feedCategoryRef.current;
    const generation = ++feedFetchGenerationRef.current;
    if (newPostsCountDebounceRef.current) {
      clearTimeout(newPostsCountDebounceRef.current);
      newPostsCountDebounceRef.current = null;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const result = await fetchPage(undefined, category);
      if (generation !== feedFetchGenerationRef.current) return;
      if (category !== feedCategoryRef.current) return;
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      lastFreshAtRef.current = Date.now();
      if (!category) applyFeedWatermark(result.globalNewestCreatedAt);
      setError(false);
      setNewPostCount(0);
    } catch {
      if (generation !== feedFetchGenerationRef.current) return;
      if (category !== feedCategoryRef.current) return;
      if (!opts?.silent) setError(true);
    } finally {
      if (generation === feedFetchGenerationRef.current && category === feedCategoryRef.current) {
        if (!opts?.silent) setLoading(false);
      }
    }
  }, [fetchPage, applyFeedWatermark]);

  const loadFreshRef = useRef(loadFresh);
  loadFreshRef.current = loadFresh;

  const categoryFetchInitialized = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const loadSanctuaryRef = useRef(loadSanctuary);
  loadSanctuaryRef.current = loadSanctuary;
  const lastFeedSanctuaryFocusRef = useRef(0);

  useEffect(() => {
    initialLoadDoneRef.current = false;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    void loadFresh();
    void loadSanctuary();
  }, [token, loadFresh, loadSanctuary]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!shouldRunThrottledFocusFetch(lastFeedSanctuaryFocusRef.current, now, DEFAULT_FOCUS_FETCH_THROTTLE_MS)) {
        return;
      }
      lastFeedSanctuaryFocusRef.current = now;
      runFeedFocusFetch({
        loadSanctuary: () => loadSanctuaryRef.current(),
        loadPosts: () => loadFreshRef.current({ silent: true }),
      });
    }, []),
  );

  useEffect(() => {
    return subscribeSanctuaryRefresh(() => void loadSanctuary({ force: true }));
  }, [loadSanctuary]);

  useEffect(() => {
    if (!categoryFetchInitialized.current) {
      categoryFetchInitialized.current = true;
      return;
    }
    feedFetchGenerationRef.current += 1;
    setPosts([]);
    setNextCursor(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    void loadFresh({ category: feedCategory });
  }, [feedCategory, loadFresh]);

  useEffect(() => {
    if (feedJumpToTopNonce === 0) return;
    newPostsScrollGateRef.current = false;
    setNewPostsScrollGate(false);
    setFeedCategory(null);
    setNewPostCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    void loadFreshRef.current({ silent: true, category: null });
    void loadSanctuary();
  }, [feedJumpToTopNonce, loadSanctuary]);

  useEffect(() => {
    return subscribePostEngagement((patch) => {
      setPosts((prev) => prev.map((p) => applyEngagementPatch(p, patch)));
      setSearchPosts((prev) => prev.map((p) => applyEngagementPatch(p, patch)));
    });
  }, []);

  useEffect(() => {
    return subscribePostRemoved((removedId) => {
      setPosts((prev) => filterRemovedPost(prev, removedId));
      setSearchPosts((prev) => filterRemovedPost(prev, removedId));
    });
  }, []);

  useEffect(() => {
    return subscribeUserBlocked((username) => {
      startTransition(() => {
        setPosts((prev) => filterPostsByAuthorUsername(prev, username));
        setSearchPosts((prev) => filterPostsByAuthorUsername(prev, username));
      });
    });
  }, []);

  useEffect(() => {
    return subscribeAppActive(() => {
      if (loading || refreshing) return;
      // Only reset the feed if the user was away long enough that freshness matters.
      // Shorter gaps just let the new-posts poll handle surfacing new content.
      if (Date.now() - lastFreshAtRef.current < 5 * 60 * 1000) return;
      // Mid-scroll silent replace jumps the user — only full-refresh when near top;
      // otherwise the new-posts pill / focus poll will surface fresh content.
      if (feedScrollYRef.current > NEW_POSTS_SCROLL_GATE_PX + 80) return;
      void loadFresh({ silent: true });
    }, 500);
  }, [loadFresh, loading, refreshing]);

  useFocusEffect(
    useCallback(() => {
      const pollNewPosts = async () => {
        if (feedCategoryRef.current != null) return;
        const maxKnown = maxKnownCreatedAtRef.current;
        if (!maxKnown) return;
        try {
          const res = await apiFetch(
            `/posts/new-count?maxKnownCreatedAt=${encodeURIComponent(maxKnown)}`,
            { token },
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            count?: number;
            globalNewestCreatedAt?: string | null;
          };
          const count = typeof data.count === "number" ? data.count : 0;
          const safe = Math.max(0, count);
          if (safe === 0 && data.globalNewestCreatedAt) {
            applyFeedWatermark(data.globalNewestCreatedAt);
          }
          if (newPostsCountDebounceRef.current) clearTimeout(newPostsCountDebounceRef.current);
          newPostsCountDebounceRef.current = setTimeout(() => {
            newPostsCountDebounceRef.current = null;
            setNewPostCount(safe);
          }, NEW_POSTS_COUNT_DEBOUNCE_MS);
        } catch {
          /* silent */
        }
      };

      const interval = setInterval(() => void pollNewPosts(), NEW_POSTS_POLL_MS);
      void pollNewPosts();
      return () => {
        clearInterval(interval);
        if (newPostsCountDebounceRef.current) {
          clearTimeout(newPostsCountDebounceRef.current);
          newPostsCountDebounceRef.current = null;
        }
      };
    }, [token, applyFeedWatermark]),
  );

  useEffect(() => {
    const showPill = newPostCount > 0 && newPostsScrollGate && !feedCategory;
    Animated.spring(pillAnim, {
      toValue: showPill ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [newPostCount, newPostsScrollGate, feedCategory, pillAnim]);

  const handleNewPostsTap = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newPostsCountDebounceRef.current) {
      clearTimeout(newPostsCountDebounceRef.current);
      newPostsCountDebounceRef.current = null;
    }
    setNewPostCount(0);
    setFeedCategory(null);
    newPostsScrollGateRef.current = false;
    setNewPostsScrollGate(false);
    try {
      await loadFreshRef.current({ silent: true, category: null });
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    } catch {
      setError(true);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (newPostsCountDebounceRef.current) {
      clearTimeout(newPostsCountDebounceRef.current);
      newPostsCountDebounceRef.current = null;
    }
    setNewPostCount(0);
    const generation = ++feedFetchGenerationRef.current;
    const category = feedCategoryRef.current;
    try {
      const result = await fetchPage(undefined, category);
      if (generation !== feedFetchGenerationRef.current) return;
      if (category !== feedCategoryRef.current) return;
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      lastFreshAtRef.current = Date.now();
      if (!category) applyFeedWatermark(result.globalNewestCreatedAt);
      void loadSanctuary();
    } catch { /* keep current data */ } finally {
      if (generation === feedFetchGenerationRef.current && category === feedCategoryRef.current) {
        setRefreshing(false);
      }
    }
  }, [fetchPage, loadSanctuary, applyFeedWatermark]);

  const handleLoadMore = useCallback(async () => {
    // Use a ref (not state) as the guard — state updates are async so the
    // state-based check lets onEndReached fire 3-6 duplicate requests before
    // React batches the setLoadingMore(true). The ref is set synchronously.
    if (loadingMoreRef.current || !nextCursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    const cursor = nextCursorRef.current;
    const generationAtStart = feedFetchGenerationRef.current;
    const categoryAtStart = feedCategoryRef.current;
    const startedAt = Date.now();
    try {
      let result = await fetchPage(cursor, categoryAtStart);
      if (
        generationAtStart !== feedFetchGenerationRef.current ||
        categoryAtStart !== feedCategoryRef.current
      ) {
        return;
      }
      const dedupeFresh = (page: Post[]) => {
        const existingIds = new Set(postsRef.current.map((p) => p.id));
        return page.filter((p) => !existingIds.has(p.id));
      };

      let fresh = dedupeFresh(result.posts);
      if (
        fresh.length === 0 &&
        result.nextCursor &&
        result.nextCursor !== cursor &&
        result.posts.length > 0
      ) {
        result = await fetchPage(result.nextCursor, categoryAtStart);
        if (
          generationAtStart !== feedFetchGenerationRef.current ||
          categoryAtStart !== feedCategoryRef.current
        ) {
          return;
        }
        fresh = dedupeFresh(result.posts);
      }

      if (fresh.length > 0) {
        setPosts((prev) => [...prev, ...fresh]);
      }
      setNextCursor(result.nextCursor);
      if (__DEV__) {
        console.info("[feed] load-more ok", {
          ms: Date.now() - startedAt,
          added: fresh.length,
          nextCursor: result.nextCursor,
        });
      }
    } catch (err) {
      setLoadMoreError(true);
      if (__DEV__) console.warn("[feed] load-more failed", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  const handleLoadMoreRef = useRef(handleLoadMore);
  handleLoadMoreRef.current = handleLoadMore;

  const handleUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleTabPressScroll = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    void loadFresh({ silent: true });
  }, [loadFresh]);

  useTabScrollToTop(handleTabPressScroll);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollHideBar(event);
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const y = contentOffset.y;
      feedScrollYRef.current = y;
      const passed = y >= NEW_POSTS_SCROLL_GATE_PX;
      if (passed !== newPostsScrollGateRef.current) {
        newPostsScrollGateRef.current = passed;
        setNewPostsScrollGate(passed);
      }
      // onEndReached is unreliable with variable-height PostCards (and now that
      // clipping is off, scroll measurement for it is weaker on both platforms),
      // so proximity scroll is the dependable load-more trigger everywhere.
      // handleLoadMore is guarded by loadingMoreRef, so this can't double-fetch.
      if (nextCursorRef.current) {
        const nearBottom =
          layoutMeasurement.height + y >= contentSize.height - LOAD_MORE_SCROLL_PADDING_PX;
        if (nearBottom) void handleLoadMoreRef.current();
      }
    },
    [onScrollHideBar],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const newPostsPillTop = topPad + Math.round(clamp(56 * uiScale, 52, 76));

  const categoryLabel = (key: string) =>
    key.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  const isEveningReflection = isEveningSanctuarySlotNow();
  const guideSlot: "morning" | "evening" = isEveningReflection ? "evening" : "morning";
  const guideMarkSize = Math.round(clamp(reflIcn * 0.92, 16, 24));

  const listHeader = useMemo(
    () => (
    <View style={{ marginBottom: 8 }}>
      <View style={[styles.feedHeaderTopRow, { paddingTop: topPad + 6 }]}>
        <View style={styles.feedHeaderLeft}>
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
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push("/(tabs)/profile" as never)}
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

      <FeedSearchDraftField
        committedQuery={committedSearchQuery}
        onSubmitQuery={onFeedSearchSubmit}
        onClearCommitted={clearCommittedSearchState}
        feedSearchFs={feedSearchFs}
        searchIconSize={feedSearchIcon}
        clearIconSize={searchClearIcn}
        placeholder="Search users and prayers…"
        accessibilityLabel="Search feed"
      />

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
        <Text style={[styles.heartPlaceholder, { fontSize: heartPlaceholderFs }]}>What can we pray for?</Text>
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
          keyboardShouldPersistTaps="handled"
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
    ),
    [
      topPad,
      user,
      greetSize,
      subGreetSize,
      committedSearchQuery,
      onFeedSearchSubmit,
      clearCommittedSearchState,
      feedSearchFs,
      feedSearchIcon,
      searchClearIcn,
      guideSlot,
      sanctuary.morning,
      sanctuary.evening,
      guideMarkSize,
      heartAv,
      heartAvRad,
      heartAvLetterFs,
      heartPlaceholderFs,
      heartPrayPadH,
      heartPrayPadV,
      uiScale,
      feedCategory,
      user?.preferredCategories,
    ],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore && !nextCursor && !loadMoreError) return null;
    return (
      <View style={styles.footerLoader}>
        {loadingMore ? <ActivityIndicator color={colors.flame} /> : null}
        {loadMoreError && !loadingMore ? (
          <Pressable
            onPress={() => void handleLoadMoreRef.current()}
            style={styles.loadMoreRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading more prayers"
          >
            <Text style={styles.loadMoreRetryText}>Tap to load more</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }, [loadingMore, nextCursor, loadMoreError]);

  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onUpdated={handleUpdated}
        feedMediaFocusPostId={feedMediaFocusPostId}
      />
    ),
    [handleUpdated, feedMediaFocusPostId],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  const showNewPostsPill = newPostCount > 0 && newPostsScrollGate && !feedCategory;

  const pillTranslateY = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });
  const pillOpacity = pillAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1],
  });

  return (
    <View
      style={[
        styles.flex,
        {
          maxWidth: LAYOUT.contentMaxWidth,
          width: "100%",
          alignSelf: "center",
        },
      ]}
    >
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPostItem}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        numColumns={1}
        ListHeaderComponent={listHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={emptyStateIcon} color={colors.muted} />
              <Text style={[styles.emptyTitle, { fontSize: emptyTitleFs }]}>Connection issue</Text>
              <Text style={[styles.emptySubtitle, { fontSize: emptySubFs }]}>Pull down to try again</Text>
            </View>
          ) : feedCategory ? (
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
        // Never clip: removeClippedSubviews detaches cells the list *thinks* are
        // off-screen and frequently fails to re-attach their media — that is the
        // "some images don't show until you tap the post" bug. windowSize keeps
        // memory bounded instead. (Load-more stays reliable via the proximity
        // scroll fallback in handleScroll, since clipping also broke onEndReached.)
        removeClippedSubviews={false}
        windowSize={9}
        maxToRenderPerBatch={8}
        initialNumToRender={10}
        updateCellsBatchingPeriod={40}
      />

      {/* "New Posts" floating pill */}
      <Animated.View
        pointerEvents={showNewPostsPill ? "auto" : "none"}
        style={[
          styles.newPostsPillWrap,
          { top: newPostsPillTop, transform: [{ translateY: pillTranslateY }], opacity: pillOpacity },
        ]}
      >
        <Pressable
          onPress={() => void handleNewPostsTap()}
          style={({ pressed }) => [styles.newPostsPill, pressed && styles.newPostsPillPressed]}
        >
          <Ionicons name="arrow-up" size={16} color={colors.surface} />
          <Text style={styles.newPostsPillText}>
            {newPostCount >= 99 ? "99+ new prayers" : `${newPostCount} new prayer${newPostCount === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      </Animated.View>

      <Modal visible={searchOpen} animationType="slide" transparent={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
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
            onSubmitQuery={onFeedSearchSubmit}
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
        </KeyboardAvoidingView>
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
  feedHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
    gap: 10,
  },
  feedHeaderLeft: {
    flex: 1,
    minWidth: 0,
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
    minHeight: 56,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreRetry: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loadMoreRetryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
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
