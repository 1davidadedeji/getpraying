import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetPosts } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);

  const personalize = (user?.preferredCategories?.length ?? 0) > 0;

  const { data, isLoading, isFetching, refetch } = useGetPosts(
    personalize ? { personalize: true } : {},
  );

  useEffect(() => {
    if (data?.posts) {
      setPosts(data.posts);
    }
  }, [data]);

  const handleUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: topPad + 4 }]}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.greeting}>
          {user?.displayName ? `Hello, ${user.displayName}` : "Get Praying"}
        </Text>
        <Text style={styles.subGreeting}>
          {personalize ? "Personalized for your categories" : "Prayer feed"}
        </Text>
      </View>
      {(user?.role === "admin" || user?.role === "moderator") && (
        <Pressable onPress={() => router.push("/admin")} style={styles.adminBtn}>
          <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );

  if (isLoading) {
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
      renderItem={({ item }) => (
        <PostCard post={item} onUpdated={handleUpdated} />
      )}
      numColumns={Platform.OS === "web" ? 2 : 1}
      columnWrapperStyle={Platform.OS === "web" ? styles.columnWrap : undefined}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="flame-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No prayers yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to share a prayer</Text>
        </View>
      }
      contentContainerStyle={[
        styles.list,
        { paddingBottom: Platform.OS === "web" ? 100 : 100 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.flame}
        />
      }
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
});
