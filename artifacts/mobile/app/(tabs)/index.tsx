import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useTabBarVisibility } from "@/context/tabBarVisibility";
import { apiUrl, authHeaders } from "@/lib/api";

const PAGE_SIZE = 20;
const NEW_POSTS_POLL_MS = 30_000;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { onScroll: onScrollHideBar } = useTabBarVisibility();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const listRef = useRef<FlatList>(null);

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
    setRefreshing(true);
    try {
      const result = await fetchPage();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      if (result.posts.length > 0) {
        topPostId.current = result.posts[0].id;
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch { /* silent */ } finally {
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

  const handleScroll = useCallback(
    (event: any) => {
      onScrollHideBar(event);
    },
    [onScrollHideBar],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: topPad + 4 }]}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.greeting}>
          {user?.displayName ? `Hello, ${user.displayName}` : "Get Praying"}
        </Text>
        <Text style={styles.subGreeting}>Your prayer feed</Text>
      </View>
      {(user?.role === "admin" || user?.role === "moderator") && (
        <Pressable onPress={() => router.push("/admin")} style={styles.adminBtn}>
          <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
        </Pressable>
      )}
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
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard post={item} onUpdated={handleUpdated} />
        )}
        numColumns={Platform.OS === "web" ? 2 : 1}
        columnWrapperStyle={Platform.OS === "web" ? styles.columnWrap : undefined}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>Connection issue</Text>
              <Text style={styles.emptySubtitle}>Pull down to try again</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>No prayers yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share a prayer</Text>
            </View>
          )
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 100 },
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
    paddingHorizontal: 16,
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
  },
  greeting: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
  },
  subGreeting: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
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
