import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { getApiBaseUrl } from "@/lib/apiBase";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAuth } from "@/context/auth";

interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  prayersShared: number;
  prayedFor: number;
  savedScrolls: number;
  createdAt: string;
}

const PAGE_SIZE = 20;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const seenIds = useRef(new Set<number>());

  const base = getApiBaseUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`${base}/api/users/${username}`, { headers });
    if (res.ok) setProfile(await res.json());
  }, [base, username, token]);

  const fetchPosts = useCallback(
    async (cursor?: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", String(cursor));
      const res = await fetch(`${base}/api/users/${username}/posts?${params}`, { headers });
      if (!res.ok) return { posts: [] as Post[], nextCursor: null };
      const data = await res.json();
      return { posts: (data.posts ?? []) as Post[], nextCursor: data.nextCursor ?? null };
    },
    [base, username, token],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      await fetchProfile();
      const result = await fetchPosts();
      seenIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, fetchPosts]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
      const result = await fetchPosts();
      seenIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchPosts]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPosts(nextCursor);
      const fresh = result.posts.filter((p) => !seenIds.current.has(p.id));
      for (const p of fresh) seenIds.current.add(p.id);
      setPosts((prev) => [...prev, ...fresh]);
      setNextCursor(result.nextCursor);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPosts]);

  const handleUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  const displayName = profile?.displayName ?? profile?.username ?? username;
  const initials = (displayName ?? "?").slice(0, 2).toUpperCase();
  const joinYear = profile ? new Date(profile.createdAt).getFullYear() : "";

  const renderHeader = () => (
    <View style={styles.profileSection}>
      <View style={styles.avatarRing}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: resolveMediaUrl(profile.avatarUrl)! }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
      </View>
      <Text style={styles.displayName}>{displayName}</Text>
      <Text style={styles.username}>@{profile?.username ?? username}</Text>
      {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {joinYear ? <Text style={styles.joinDate}>Member since {joinYear}</Text> : null}

      <View style={styles.statsRow}>
        <StatCard label="Prayers Shared" value={profile?.prayersShared ?? 0} />
        <StatCard label="Prayed For" value={profile?.prayedFor ?? 0} />
      </View>

      <Text style={styles.postsTitle}>Prayers</Text>
    </View>
  );

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <PostCard post={item} onUpdated={handleUpdated} replaceNav />}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>No prayers yet</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.flame} />
          </View>
        ) : null
      }
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.flame} />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  list: { backgroundColor: colors.cream, paddingHorizontal: 16, paddingBottom: 100, maxWidth: 680, alignSelf: "center" as const, width: "100%" },
  profileSection: { alignItems: "center", gap: 6, paddingTop: 12, paddingBottom: 20 },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 3,
    marginBottom: 4,
  },
  avatar: {
    flex: 1,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 26, color: colors.accent },
  displayName: { fontFamily: "NotoSerif_700Bold", fontSize: 20, color: colors.primary },
  username: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 14, color: colors.muted },
  bio: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  joinDate: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 20, color: colors.primary },
  statLabel: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 11, color: colors.muted, textAlign: "center" },
  postsTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 14, color: colors.muted },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
});
