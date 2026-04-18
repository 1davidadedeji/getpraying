import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useGetSavedPrayers, getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { SAVED_POSTS_EMPTY } from "@/constants/savedList";

type Props = {
  /** When false, the query does not run (saves requests when tab hidden). */
  queryEnabled?: boolean;
  /** Refetch saved list when the screen gains focus (e.g. Library tab). */
  invalidateOnFocus?: boolean;
  listRef?: React.RefObject<FlatList<Post> | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  paddingHorizontal?: number;
};

export function SavedPrayersList({
  queryEnabled = true,
  invalidateOnFocus = false,
  listRef,
  contentContainerStyle,
  paddingHorizontal = 16,
}: Props) {
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

  return (
    <FlatList
      ref={listRef}
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal }}>
          <PostCard post={item} />
        </View>
      )}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        loadingSaved ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{SAVED_POSTS_EMPTY.title}</Text>
            <Text style={styles.emptySubtext}>{SAVED_POSTS_EMPTY.subtitle}</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
});
