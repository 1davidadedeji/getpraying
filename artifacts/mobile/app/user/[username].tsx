import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { showAppAlert } from "@/components/AppAlert";
import { StatCard } from "@/components/StatCard";
import colors from "@/constants/colors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  prayersShared: number;
  prayedFor: number;
  savedScrolls: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { token, user: me } = useAuth();
  const [followBusy, setFollowBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const seenIds = useRef(new Set<number>());

  const headers = authHeaders(token);

  const fetchProfile = useCallback(async () => {
    const res = await fetch(apiUrl(`/users/${username}`), { headers });
    if (res.ok) setProfile(await res.json());
  }, [username, token]);

  const fetchPosts = useCallback(
    async (cursor?: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", String(cursor));
      const res = await fetch(apiUrl(`/users/${username}/posts?${params}`), { headers });
      if (!res.ok) return { posts: [] as Post[], nextCursor: null };
      const data = await res.json();
      return { posts: (data.posts ?? []) as Post[], nextCursor: data.nextCursor ?? null };
    },
    [username, token],
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
      {joinYear ? <Text style={styles.joinDate}>Member since {joinYear}</Text> : null}

      <View style={styles.statsRow}>
        <StatCard compact label="Prayers Shared" value={profile?.prayersShared ?? 0} />
        <StatCard compact label="Prayed For" value={profile?.prayedFor ?? 0} />
        <StatCard compact label="Saved Scrolls" value={profile?.savedScrolls ?? 0} />
      </View>

      {profile && me && me.username !== profile.username && token && profile.isFollowing !== undefined && (
        <Pressable
          style={[styles.followBtn, profile.isFollowing && styles.followBtnOutline]}
          disabled={followBusy}
          onPress={() => {
            if (!profile || !token) return;
            const next = !profile.isFollowing;
            const runToggle = () => {
              setFollowBusy(true);
              void (async () => {
                try {
                  const res = await fetch(apiUrl(`/users/${profile.username}/follow`), {
                    method: next ? "POST" : "DELETE",
                    headers: authHeaders(token),
                  });
                  if (res.ok) {
                    setProfile((p) =>
                      p
                        ? {
                            ...p,
                            isFollowing: next,
                            followerCount: Math.max(
                              0,
                              (p.followerCount ?? 0) + (next ? 1 : -1),
                            ),
                          }
                        : p,
                    );
                  }
                } finally {
                  setFollowBusy(false);
                }
              })();
            };
            if (profile.isFollowing && !next) {
              showAppAlert({
                title: "Unfollow?",
                message: `You will stop seeing ${profile.displayName ?? profile.username} in your following list.`,
                buttons: [
                  { text: "Cancel", style: "cancel" },
                  { text: "Unfollow", style: "destructive", onPress: runToggle },
                ],
              });
              return;
            }
            runToggle();
          }}
        >
          <Text style={[styles.followBtnText, profile.isFollowing && styles.followBtnTextOutline]}>
            {profile.isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      )}

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
  joinDate: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 12 },
  postsTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  followBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followBtnOutline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  followBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.surface,
  },
  followBtnTextOutline: {
    color: colors.primary,
  },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 14, color: colors.muted },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
});
