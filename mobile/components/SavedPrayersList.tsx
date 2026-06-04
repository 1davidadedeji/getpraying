import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useGetSavedPrayers, getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { SAVED_POSTS_EMPTY } from "@/constants/savedList";
import { applyEngagementPatch, filterRemovedPost, subscribePostEngagement, subscribePostRemoved } from "@/lib/postEngagementSync";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

type Props = {
  /** When false, the query does not run (saves requests when tab hidden). */
  queryEnabled?: boolean;
  /** Refetch saved list when the screen gains focus (e.g. Library tab). */
  invalidateOnFocus?: boolean;
  listRef?: React.RefObject<FlatList<Post> | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Defaults to `gutter` from responsive layout */
  paddingHorizontal?: number;
};

export function SavedPrayersList({
  queryEnabled = true,
  invalidateOnFocus = false,
  listRef,
  contentContainerStyle,
  paddingHorizontal: paddingHorizontalProp,
}: Props) {
  const { gutter, uiScale } = useResponsiveLayout();
  const paddingHorizontal = paddingHorizontalProp ?? gutter;
  const loaderMt = Math.round(clamp(40 * uiScale, 32, 48));
  const emptyIcon = Math.round(clamp(40 * uiScale, 34, 48));
  const emptyPt = Math.round(clamp(60 * uiScale, 48, 72));
  const emptyGap = Math.round(clamp(10 * uiScale, 8, 12));
  const emptyTitleFs = Math.round(clamp(16 * uiScale, 15, 18));
  const emptySubFs = Math.round(clamp(13 * uiScale, 12, 14));

  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      if (invalidateOnFocus && queryEnabled) {
        queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
      }
    }, [invalidateOnFocus, queryEnabled, queryClient]),
  );

  const { data: savedData, isLoading: loadingSaved } = useGetSavedPrayers({
    query: {
      queryKey: getGetSavedPrayersQueryKey(),
      enabled: queryEnabled,
    },
  });

  const posts = (savedData as { posts?: Post[] } | undefined)?.posts ?? [];

  useEffect(() => {
    return subscribePostEngagement((patch) => {
      queryClient.setQueryData(getGetSavedPrayersQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const raw = old as { posts?: Post[] };
        if (!Array.isArray(raw.posts)) return old;
        return { ...raw, posts: raw.posts.map((p) => applyEngagementPatch(p, patch)) };
      });
    });
  }, [queryClient]);

  useEffect(() => {
    return subscribePostRemoved((removedId) => {
      queryClient.setQueryData(getGetSavedPrayersQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const raw = old as { posts?: Post[] };
        if (!Array.isArray(raw.posts)) return old;
        return { ...raw, posts: filterRemovedPost(raw.posts, removedId) };
      });
    });
  }, [queryClient]);

  const handlePostUpdated = useCallback(
    (updated: Post) => {
      queryClient.setQueryData(getGetSavedPrayersQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const raw = old as { posts?: Post[] };
        if (!Array.isArray(raw.posts)) return old;
        return {
          ...raw,
          posts: raw.posts.map((p) => (p.id === updated.id ? updated : p)),
        };
      });
    },
    [queryClient],
  );

  return (
    <FlatList
      ref={listRef}
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal }}>
          <PostCard post={item} onUpdated={handlePostUpdated} />
        </View>
      )}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        loadingSaved ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: loaderMt }} />
        ) : (
          <View style={[styles.emptyState, { paddingTop: emptyPt, gap: emptyGap }]}>
            <Ionicons name="bookmark-outline" size={emptyIcon} color={colors.muted} />
            <Text style={[styles.emptyText, { fontSize: emptyTitleFs }]}>{SAVED_POSTS_EMPTY.title}</Text>
            <Text style={[styles.emptySubtext, { fontSize: emptySubFs }]}>{SAVED_POSTS_EMPTY.subtitle}</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
});
