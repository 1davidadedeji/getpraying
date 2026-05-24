import { Ionicons } from "@expo/vector-icons";

import type { Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialTabBar, Tabs, type TabBarProps } from "react-native-collapsible-tab-view";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { ProfileCollapsibleHeaderShell } from "@/components/ProfileCollapsibleHeaderShell";
import { showAppAlert } from "@/components/AppAlert";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { StatCard } from "@/components/StatCard";
import colors from "@/constants/colors";
import { LAYOUT } from "@/constants/layout";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { clamp } from "@/lib/responsiveMetrics";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
  location?: string | null;
  avatarUrl: string | null;
  prayersShared: number;
  prayedFor: number;
  savedScrolls: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  createdAt: string;
}

const USER_PROFILE_TABS = [
  { key: "prayers" as const, label: "Prayers" },
  { key: "interactions" as const, label: "Interactions" },
  { key: "saved" as const, label: "Saved" },
];
type UserProfileTabKey = (typeof USER_PROFILE_TABS)[number]["key"];

type PagerViewOnPage = import("react-native").NativeSyntheticEvent<{ position: number }>;

const PAGE_SIZE = 20;

export default function UserProfileScreen() {
  useStackHeaderBack("/(tabs)" as Href);
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();
  const { gutter, uiScale, tabLabelSize } = useResponsiveLayout();
  const listBotPad = Math.round(clamp(100 * uiScale, 88, 112));
  const { token, user: me } = useAuth();
  const isOwnProfile = !!me && me.username === username;

  const [followBusy, setFollowBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<UserProfileTabKey>("prayers");
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [profileCollapsibleHeaderH, setProfileCollapsibleHeaderH] = useState(400);
  const webPagerRef = useRef<PagerView>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsNextCursor, setPostsNextCursor] = useState<number | null>(null);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const seenPostIds = useRef(new Set<number>());

  const [interactions, setInteractions] = useState<Post[]>([]);
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);

  const [saved, setSaved] = useState<Post[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const {
    feedMediaFocusPostId,
    onViewableItemsChanged: onParentViewable,
    viewabilityConfig,
    clearFeedMediaFocus,
  } = useFeedMediaViewability();

  useEffect(() => {
    clearFeedMediaFocus();
  }, [activeTab, clearFeedMediaFocus]);

  const onPrayersViewable = useCallback(
    (info: Parameters<typeof onParentViewable>[0]) => {
      if (activeTabRef.current !== "prayers") return;
      onParentViewable(info);
    },
    [onParentViewable],
  );
  const onInteractionsViewable = useCallback(
    (info: Parameters<typeof onParentViewable>[0]) => {
      if (activeTabRef.current !== "interactions") return;
      onParentViewable(info);
    },
    [onParentViewable],
  );
  const onSavedViewable = useCallback(
    (info: Parameters<typeof onParentViewable>[0]) => {
      if (activeTabRef.current !== "saved") return;
      onParentViewable(info);
    },
    [onParentViewable],
  );

  const fetchProfile = useCallback(async () => {
    const res = await fetch(apiUrl(`/users/${username}`), { headers: authHeaders(token) });
    if (res.ok) setProfile(await res.json());
  }, [username, token]);

  const fetchPosts = useCallback(
    async (cursor?: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", String(cursor));
      const res = await fetch(apiUrl(`/users/${username}/posts?${params}`), {
        headers: authHeaders(token),
      });
      if (!res.ok) return { posts: [] as Post[], nextCursor: null };
      const data = await res.json();
      return { posts: (data.posts ?? []) as Post[], nextCursor: data.nextCursor ?? null };
    },
    [username, token],
  );

  const fetchInteractions = useCallback(async () => {
    const h = authHeaders(token);
    const base = isOwnProfile && token ? "/users/me" : `/users/${username}`;
    const [likedRes, commentedRes] = await Promise.all([
      fetch(apiUrl(`${base}/liked-posts`), { headers: h }),
      fetch(apiUrl(`${base}/commented-posts`), { headers: h }),
    ]);
    const likedData = likedRes.ok ? await likedRes.json() : {};
    const commentedData = commentedRes.ok ? await commentedRes.json() : {};
    const liked: Post[] = likedData.posts ?? [];
    const commented: Post[] = commentedData.posts ?? [];
    const seen = new Set<number>();
    const merged: Post[] = [];
    for (const p of [...liked, ...commented]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    setInteractions(merged);
    setInteractionsLoaded(true);
  }, [username, token, isOwnProfile]);

  const fetchSaved = useCallback(async () => {
    const res = await fetch(apiUrl(`/users/${username}/saved-posts?limit=50`), {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      setSaved([]);
      setSavedLoaded(true);
      return;
    }
    const data = await res.json();
    setSaved((data.posts ?? []) as Post[]);
    setSavedLoaded(true);
  }, [username, token]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      await fetchProfile();
      const result = await fetchPosts();
      seenPostIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setPostsNextCursor(result.nextCursor);
    } catch {
      /* keep shell */
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, fetchPosts]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (activeTab === "interactions" && !interactionsLoaded) void fetchInteractions();
    if (activeTab === "saved" && !savedLoaded) void fetchSaved();
  }, [activeTab, interactionsLoaded, savedLoaded, fetchInteractions, fetchSaved]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
      const result = await fetchPosts();
      seenPostIds.current = new Set(result.posts.map((p) => p.id));
      setPosts(result.posts);
      setPostsNextCursor(result.nextCursor);
      setInteractionsLoaded(false);
      setSavedLoaded(false);
      if (activeTab === "interactions") void fetchInteractions();
      if (activeTab === "saved") void fetchSaved();
    } catch {
      /* silent */
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchPosts, activeTab, fetchInteractions, fetchSaved]);

  const handleLoadMorePosts = useCallback(async () => {
    if (!postsNextCursor || loadingMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const result = await fetchPosts(postsNextCursor);
      const fresh = result.posts.filter((p) => !seenPostIds.current.has(p.id));
      for (const p of fresh) seenPostIds.current.add(p.id);
      setPosts((prev) => [...prev, ...fresh]);
      setPostsNextCursor(result.nextCursor);
    } catch {
      /* silent */
    } finally {
      setLoadingMorePosts(false);
    }
  }, [postsNextCursor, loadingMorePosts, fetchPosts]);

  const handleUpdated = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setInteractions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSaved((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const onTabChange = useCallback((data: { tabName: string }) => {
    setActiveTab(data.tabName as UserProfileTabKey);
  }, []);

  const goToTabWeb = useCallback((key: UserProfileTabKey) => {
    setActiveTab(key);
    const idx = USER_PROFILE_TABS.findIndex((t) => t.key === key);
    if (idx >= 0 && webPagerRef.current) {
      try {
        webPagerRef.current.setPage(idx);
      } catch {
        /* noop */
      }
    }
  }, []);

  const onWebPagerPageSelected = useCallback((e: PagerViewOnPage) => {
    const p = e.nativeEvent.position;
    const key = USER_PROFILE_TABS[p]?.key;
    if (key) setActiveTab(key);
  }, []);

  const tabBarH = Math.round(clamp(48 * uiScale, 44, 56));
  const tabListTopSpacer = Math.round(clamp(14 * uiScale, 12, 18));
  const tabIndicatorH = Math.max(2, Math.round(2 * uiScale));

  const profilePostsListHeader = useMemo(
    () => <View style={{ height: tabListTopSpacer }} />,
    [tabListTopSpacer],
  );

  const renderMaterialTabBar = useCallback(
    (props: TabBarProps) => (
      <View style={styles.tabBarSurface}>
        <MaterialTabBar
          {...props}
          scrollEnabled={false}
          getLabelText={(name) =>
            USER_PROFILE_TABS.find((t) => t.key === (name as UserProfileTabKey))?.label ?? String(name)
          }
          activeColor={colors.primary}
          inactiveColor={colors.muted}
          labelStyle={[styles.materialTabLabel, { fontSize: tabLabelSize }]}
          tabStyle={[styles.materialTabItem, { minHeight: Math.round(clamp(44 * uiScale, 40, 48)), paddingVertical: Math.round(clamp(8 * uiScale, 6, 10)) }]}
          style={styles.materialTabBar}
          indicatorStyle={[styles.tabIndicator, { height: tabIndicatorH }]}
        />
      </View>
    ),
    [tabLabelSize, tabIndicatorH, uiScale],
  );

  const displayName = profile?.displayName ?? profile?.username ?? username;
  const initials = (displayName ?? "?").slice(0, 2).toUpperCase();
  const joinYear = profile ? new Date(profile.createdAt).getFullYear() : "";

  const renderProfileHeaderBody = useCallback(
    () => (
      <View style={[styles.profileSection, { paddingHorizontal: gutter }]}>
        <View style={styles.avatarRing}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(profile.avatarUrl)! }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {displayName}
        </Text>
        <Text style={styles.username} numberOfLines={1} ellipsizeMode="middle">
          @{profile?.username ?? username}
        </Text>
        {joinYear ? <Text style={styles.joinDate}>Member since {joinYear}</Text> : null}
        {profile?.location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {profile.location}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard compact label="Prayers Shared" value={profile?.prayersShared ?? 0} />
          <StatCard compact label="Prayed For" value={profile?.prayedFor ?? 0} />
          <StatCard compact label="Saved Prayers" value={profile?.savedScrolls ?? 0} />
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
                              followerCount: Math.max(0, (p.followerCount ?? 0) + (next ? 1 : -1)),
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
      </View>
    ),
    [profile, username, displayName, initials, joinYear, gutter, me, token, followBusy],
  );

  const renderCollapsibleHeader = useCallback(() => {
    return (
      <View
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0) {
            setProfileCollapsibleHeaderH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
          }
        }}
      >
        <ProfileCollapsibleHeaderShell>{renderProfileHeaderBody()}</ProfileCollapsibleHeaderShell>
      </View>
    );
  }, [renderProfileHeaderBody]);

  const prayersEmpty = (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={40} color={colors.muted} />
      <Text style={styles.emptyText}>No prayers yet</Text>
    </View>
  );

  const interactionsEmpty = (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={40} color={colors.muted} />
      <Text style={styles.emptyText}>No interactions yet</Text>
    </View>
  );

  const savedEmpty = (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={40} color={colors.muted} />
      <Text style={styles.emptyText}>No saved prayers yet</Text>
    </View>
  );

  const listPad = {
    paddingBottom: listBotPad + insets.bottom,
    maxWidth: LAYOUT.contentMaxWidth,
    width: "100%" as const,
    alignSelf: "center" as const,
  };

  const refreshCtl = (
    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.flame} />
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  const webTabRow = (
    <View style={[styles.webTabRow, { paddingHorizontal: gutter }]}>
      {USER_PROFILE_TABS.map(({ key, label }) => (
        <Pressable
          key={key}
          style={[styles.webTab, activeTab === key && styles.webTabActive]}
          onPress={() => goToTabWeb(key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === key }}
        >
          <Text style={[styles.webTabText, activeTab === key && styles.webTabTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const webProfileListHeader = (
    <>
      <View style={styles.webStaticHeaderBlock}>{renderProfileHeaderBody()}</View>
      {profilePostsListHeader}
    </>
  );

  const prayersList = (
    <FlatList
      data={posts}
      keyExtractor={(item) => `p-${item.id}`}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: gutter }}>
          <PostCard
            post={item}
            onUpdated={handleUpdated}
            replaceNav
            activeProfileUsername={username}
            feedMediaFocusPostId={activeTab === "prayers" ? feedMediaFocusPostId : null}
          />
        </View>
      )}
      ListHeaderComponent={webProfileListHeader}
      ListEmptyComponent={prayersEmpty}
      ListFooterComponent={
        loadingMorePosts ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.flame} />
          </View>
        ) : null
      }
      contentContainerStyle={[styles.list, listPad, posts.length === 0 ? { flexGrow: 1 } : null]}
      refreshControl={refreshCtl}
      onEndReached={handleLoadMorePosts}
      onEndReachedThreshold={0.4}
      onViewableItemsChanged={onPrayersViewable}
      viewabilityConfig={viewabilityConfig}
      showsVerticalScrollIndicator={false}
    />
  );

  const interactionsList = (
    <FlatList
      data={interactionsLoaded ? interactions : []}
      keyExtractor={(item) => `i-${item.id}`}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: gutter }}>
          <PostCard
            post={item}
            onUpdated={handleUpdated}
            replaceNav
            activeProfileUsername={username}
            feedMediaFocusPostId={activeTab === "interactions" ? feedMediaFocusPostId : null}
          />
        </View>
      )}
      ListHeaderComponent={webProfileListHeader}
      ListEmptyComponent={
        !interactionsLoaded ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.flame} />
          </View>
        ) : (
          interactionsEmpty
        )
      }
      contentContainerStyle={[
        styles.list,
        listPad,
        interactions.length === 0 && interactionsLoaded ? { flexGrow: 1 } : null,
      ]}
      refreshControl={refreshCtl}
      onViewableItemsChanged={onInteractionsViewable}
      viewabilityConfig={viewabilityConfig}
      showsVerticalScrollIndicator={false}
    />
  );

  const savedList = (
    <FlatList
      data={savedLoaded ? saved : []}
      keyExtractor={(item) => `s-${item.id}`}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: gutter }}>
          <PostCard
            post={item}
            onUpdated={handleUpdated}
            replaceNav
            activeProfileUsername={username}
            feedMediaFocusPostId={activeTab === "saved" ? feedMediaFocusPostId : null}
          />
        </View>
      )}
      ListHeaderComponent={webProfileListHeader}
      ListEmptyComponent={
        !savedLoaded ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.flame} />
          </View>
        ) : (
          savedEmpty
        )
      }
      contentContainerStyle={[
        styles.list,
        listPad,
        saved.length === 0 && savedLoaded ? { flexGrow: 1 } : null,
      ]}
      refreshControl={refreshCtl}
      onViewableItemsChanged={onSavedViewable}
      viewabilityConfig={viewabilityConfig}
      showsVerticalScrollIndicator={false}
    />
  );

  if (Platform.OS === "web") {
    return (
      <View style={[styles.flex, { maxWidth: LAYOUT.contentMaxWidth, width: "100%", alignSelf: "center" }]}>
        {webTabRow}
        <PagerView
          ref={webPagerRef}
          style={styles.flex}
          initialPage={0}
          onPageSelected={onWebPagerPageSelected}
        >
          <View style={styles.flex} collapsable={false}>
            {prayersList}
          </View>
          <View style={styles.flex} collapsable={false}>
            {interactionsList}
          </View>
          <View style={styles.flex} collapsable={false}>
            {savedList}
          </View>
        </PagerView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { maxWidth: LAYOUT.contentMaxWidth, width: "100%", alignSelf: "center" }]}>
      <Tabs.Container
        containerStyle={styles.flex}
        headerHeight={profileCollapsibleHeaderH}
        minHeaderHeight={0}
        tabBarHeight={tabBarH}
        initialTabName="prayers"
        renderHeader={renderCollapsibleHeader}
        renderTabBar={renderMaterialTabBar}
        onTabChange={onTabChange}
      >
        <Tabs.Tab name="prayers" label="Prayers">
          <Tabs.FlatList
            data={posts}
            keyExtractor={(item: Post) => `p-${item.id}`}
            renderItem={({ item }: { item: Post }) => (
              <View style={{ paddingHorizontal: gutter }}>
                <PostCard
                  post={item}
                  onUpdated={handleUpdated}
                  replaceNav
                  activeProfileUsername={username}
                  feedMediaFocusPostId={activeTab === "prayers" ? feedMediaFocusPostId : null}
                />
              </View>
            )}
            ListHeaderComponent={profilePostsListHeader}
            ListEmptyComponent={prayersEmpty}
            ListFooterComponent={
              loadingMorePosts ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={colors.flame} />
                </View>
              ) : null
            }
            contentContainerStyle={[
              styles.list,
              { paddingBottom: listBotPad + insets.bottom },
              posts.length === 0 ? { flexGrow: 1 } : null,
            ]}
            refreshControl={refreshCtl}
            onEndReached={handleLoadMorePosts}
            onEndReachedThreshold={0.4}
            onViewableItemsChanged={onPrayersViewable}
            viewabilityConfig={viewabilityConfig}
            showsVerticalScrollIndicator={false}
          />
        </Tabs.Tab>
        <Tabs.Tab name="interactions" label="Interactions">
          <Tabs.FlatList
            data={interactionsLoaded ? interactions : []}
            keyExtractor={(item: Post) => `i-${item.id}`}
            renderItem={({ item }: { item: Post }) => (
              <View style={{ paddingHorizontal: gutter }}>
                <PostCard
                  post={item}
                  onUpdated={handleUpdated}
                  replaceNav
                  activeProfileUsername={username}
                  feedMediaFocusPostId={activeTab === "interactions" ? feedMediaFocusPostId : null}
                />
              </View>
            )}
            ListHeaderComponent={profilePostsListHeader}
            ListEmptyComponent={
              !interactionsLoaded ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color={colors.flame} />
                </View>
              ) : (
                interactionsEmpty
              )
            }
            contentContainerStyle={[
              styles.list,
              { paddingBottom: listBotPad + insets.bottom },
              interactions.length === 0 && interactionsLoaded ? { flexGrow: 1 } : null,
            ]}
            refreshControl={refreshCtl}
            onViewableItemsChanged={onInteractionsViewable}
            viewabilityConfig={viewabilityConfig}
            showsVerticalScrollIndicator={false}
          />
        </Tabs.Tab>
        <Tabs.Tab name="saved" label="Saved">
          <Tabs.FlatList
            data={savedLoaded ? saved : []}
            keyExtractor={(item: Post) => `s-${item.id}`}
            renderItem={({ item }: { item: Post }) => (
              <View style={{ paddingHorizontal: gutter }}>
                <PostCard
                  post={item}
                  onUpdated={handleUpdated}
                  replaceNav
                  activeProfileUsername={username}
                  feedMediaFocusPostId={activeTab === "saved" ? feedMediaFocusPostId : null}
                />
              </View>
            )}
            ListHeaderComponent={profilePostsListHeader}
            ListEmptyComponent={
              !savedLoaded ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color={colors.flame} />
                </View>
              ) : (
                savedEmpty
              )
            }
            contentContainerStyle={[
              styles.list,
              { paddingBottom: listBotPad + insets.bottom },
              saved.length === 0 && savedLoaded ? { flexGrow: 1 } : null,
            ]}
            refreshControl={refreshCtl}
            onViewableItemsChanged={onSavedViewable}
            viewabilityConfig={viewabilityConfig}
            showsVerticalScrollIndicator={false}
          />
        </Tabs.Tab>
      </Tabs.Container>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  list: { backgroundColor: colors.cream },
  profileSection: { alignItems: "center", gap: 6, paddingTop: 12, paddingBottom: 8 },
  webStaticHeaderBlock: { backgroundColor: colors.cream },
  webTabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
  },
  webTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  webTabActive: { borderBottomColor: colors.flame },
  webTabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  webTabTextActive: { color: colors.flame },
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
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.muted, maxWidth: 180 },
  statsRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 12 },
  tabBarSurface: {
    backgroundColor: colors.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  materialTabBar: {
    backgroundColor: colors.cream,
    elevation: 0,
    shadowOpacity: 0,
  },
  materialTabItem: {
    minHeight: 44,
    paddingVertical: 8,
  },
  materialTabLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    textAlign: "center",
  },
  tabIndicator: {
    backgroundColor: colors.primary,
    height: 2,
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
