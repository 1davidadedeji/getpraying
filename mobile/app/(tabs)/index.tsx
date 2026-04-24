import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { getGetDailyWordQueryKey, useGetDailyWord } from "@workspace/api-client-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
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
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useModerationBadge } from "@/context/moderationBadge";
import { useTabBarVisibility } from "@/context/tabBarVisibility";
import { apiUrl, authHeaders } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";
import { formatLocalYMD } from "@/lib/date";
import { clamp } from "@/lib/responsiveMetrics";

const PAGE_SIZE = 20;
const NEW_POSTS_POLL_MS = 30_000;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, feedInnerWidth, useTwoColumnFeed, uiScale } = useResponsiveLayout();
  const greetSize = Math.round(clamp(24 * uiScale, 22, 28));
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
  const { pendingCount: modPending } = useModerationBadge();
  const { onScroll: onScrollHideBar } = useTabBarVisibility();
  const todayYmd = useMemo(() => formatLocalYMD(new Date()), []);
  const { data: dailyWord } = useGetDailyWord(
    { date: todayYmd },
    { query: { queryKey: getGetDailyWordQueryKey({ date: todayYmd }), staleTime: 60_000 } },
  );
  const [feedCategory, setFeedCategory] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { feedMediaFocusPostId, onViewableItemsChanged, viewabilityConfig } = useFeedMediaViewability();

  const [newPostCount, setNewPostCount] = useState(0);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const topPostId = useRef<number | null>(null);

  const fetchPage = useCallback(
    async (cursor?: number): Promise<{ posts: Post[]; nextCursor: number | null }> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", String(cursor));

      const res = await fetch(apiUrl(`/posts?${params}`), {
        headers: authHeaders(token),
      });
      if (!res.ok) return { posts: [], nextCursor: null };
      const data = await res.json();
      return { posts: data.posts ?? [], nextCursor: data.nextCursor ?? null };
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

  useEffect(() => {
    loadFresh();
  }, [loadFresh]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadFresh({ silent: true });
      }
    }, [loading, loadFresh]),
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
    } catch { /* keep current data */ } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

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

  const isEveningReflection = useMemo(() => new Date().getHours() >= 17, []);

  const renderHeader = () => (
    <View style={{ marginBottom: 8 }}>
      <View style={[styles.header, { paddingTop: topPad + 4 }]}>
        <View style={styles.headerTextBlock}>
          <Text
            style={[styles.greeting, { fontSize: greetSize }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {user?.displayName ? `Hello, ${user.displayName}` : "GetPraying"}
          </Text>
          <Text style={[styles.subGreeting, { fontSize: subGreetSize }]}>Your prayer feed</Text>
        </View>
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
              <Image
                source={{ uri: resolveMediaUrl(user.avatarUrl)! }}
                style={styles.headerAvatarImg}
              />
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

      <Pressable
        onPress={() => router.push("/library")}
        style={({ pressed }) => [
          styles.reflectionCard,
          isEveningReflection && styles.reflectionCardEvening,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.reflectionTop}>
          <Ionicons
            name={isEveningReflection ? "moon-outline" : "sunny-outline"}
            size={reflIcn}
            color={colors.accent}
          />
          <Text style={styles.reflectionLabel}>
            {isEveningReflection ? "Evening reflection" : "Morning reflection"}
          </Text>
        </View>
        <Text style={styles.reflectionQuote} numberOfLines={3}>
          &ldquo;{dailyWord?.quoteText ?? "Be still, and know that I am God."}&rdquo;
        </Text>
        <Text style={styles.reflectionRef}>{dailyWord?.reference ?? "Psalm 46:10"}</Text>
      </Pressable>

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
        <Text style={[styles.heartPlaceholder, { fontSize: heartPlaceholderFs }]}>What&apos;s on your heart?</Text>
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
          {user!.preferredCategories!.map((cat) => {
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
        numColumns={useTwoColumnFeed ? 2 : 1}
        columnWrapperStyle={useTwoColumnFeed ? styles.columnWrap : undefined}
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
            maxWidth: feedInnerWidth,
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
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
  columnWrap: {
    gap: 12,
    justifyContent: "space-between",
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
  reflectionCard: {
    backgroundColor: "#E8F0FA",
    borderRadius: 20,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(26,43,74,0.08)",
    gap: 4,
  },
  reflectionCardEvening: {
    backgroundColor: "#F3E8DD",
    borderColor: "rgba(92,74,58,0.12)",
  },
  reflectionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reflectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reflectionQuote: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  reflectionRef: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    fontStyle: "italic",
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
