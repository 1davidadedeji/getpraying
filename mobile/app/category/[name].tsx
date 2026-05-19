import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { LAYOUT } from "@/constants/layout";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { clamp } from "@/lib/responsiveMetrics";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

const PAGE_SIZE = 20;

export default function CategoryFeedScreen() {
  useStackHeaderBack("/(tabs)/library" as Href);
  const { name } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const listBotPad = Math.round(clamp(100 * uiScale, 88, 112));
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const seenIds = useRef(new Set<number>());
  const { feedMediaFocusPostId, onViewableItemsChanged, viewabilityConfig } = useFeedMediaViewability();

  const categoryDisplay = name ? decodeURIComponent(name).replace(/^\w/, (c) => c.toUpperCase()) : "";

  const fetchPage = useCallback(
    async (cursor?: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), category: name ?? "" });
      if (cursor) params.set("cursor", String(cursor));
      const res = await fetch(apiUrl(`/posts?${params}`), { headers: authHeaders(token) });
      if (!res.ok) return { posts: [] as Post[], nextCursor: null };
      const data = await res.json();
      return { posts: (data.posts ?? []) as Post[], nextCursor: data.nextCursor ?? null };
    },
    [token, name],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPage();
      seenIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchPage();
      seenIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPage(nextCursor);
      const fresh = result.posts.filter((p) => !seenIds.current.has(p.id));
      for (const p of fresh) seenIds.current.add(p.id);
      setPosts((prev) => [...prev, ...fresh]);
      setNextCursor(result.nextCursor);
    } catch { /* silent */ } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <PostCard post={item} feedMediaFocusPostId={feedMediaFocusPostId} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {categoryDisplay}
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.flame} />
          </View>
        ) : null
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
            <Ionicons name="flame-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>No prayers yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to share a prayer in this category</Text>
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
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.4}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
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
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
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
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
