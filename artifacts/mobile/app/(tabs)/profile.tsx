import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialTabBar, Tabs, type TabBarProps } from "react-native-collapsible-tab-view";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe, getGetMeQueryKey, useGetSavedPrayers, getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import type { Post, User } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { PreferredCategoriesContent } from "@/components/PreferredCategoriesContent";
import { StatCard } from "@/components/StatCard";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import { PROFILE_MAIN_TABS, type ProfileMainTabKey } from "@/constants/profileTabs";
import { SAVED_POSTS_EMPTY } from "@/constants/savedList";
import { useAuth } from "@/context/auth";
import { useModerationBadge } from "@/context/moderationBadge";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { apiUrl, authHeaders } from "@/lib/api";
import { useFeedMediaViewability } from "@/hooks/useFeedMediaViewability";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";

/** Must match collapsible header layout so list content starts at the first item (library measures wrong if omitted). */
const PROFILE_COLLAPSIBLE_HEADER_HEIGHT = 312;

type PagerViewOnPage = import("react-native").NativeSyntheticEvent<{ position: number }>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, refreshUser, token } = useAuth();
  const { pendingCount: modPending, refresh: refreshModBadge } = useModerationBadge();
  const myListRef = useRef<FlatList<Post>>(null);
  const savedListRef = useRef<FlatList<Post>>(null);
  const categoriesScrollRef = useRef<ScrollView>(null);
  const webPagerRef = useRef<PagerView | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileMainTabKey>("my");
  const activeTabRef = useRef<ProfileMainTabKey>(activeTab);
  activeTabRef.current = activeTab;

  const {
    feedMediaFocusPostId,
    onViewableItemsChanged: onProfileFeedViewable,
    viewabilityConfig: profileFeedViewabilityConfig,
    clearFeedMediaFocus,
  } = useFeedMediaViewability();

  const onMyFeedViewableItemsChanged = useCallback(
    (info: Parameters<typeof onProfileFeedViewable>[0]) => {
      if (activeTabRef.current !== "my") return;
      onProfileFeedViewable(info);
    },
    [onProfileFeedViewable],
  );

  const onSavedFeedViewableItemsChanged = useCallback(
    (info: Parameters<typeof onProfileFeedViewable>[0]) => {
      if (activeTabRef.current !== "saved") return;
      onProfileFeedViewable(info);
    },
    [onProfileFeedViewable],
  );

  useEffect(() => {
    clearFeedMediaFocus();
  }, [activeTab, clearFeedMediaFocus]);

  const { data: freshUser, refetch: refetchMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, staleTime: 0 },
  });

  useEffect(() => {
    if (freshUser) refreshUser(freshUser as User);
  }, [freshUser, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      if (token) void refetchMe();
      void refreshModBadge();
    }, [token, refetchMe, refreshModBadge]),
  );

  const { data: savedPrayersData, isLoading: loadingSavedTab } = useGetSavedPrayers({
    query: {
      queryKey: getGetSavedPrayersQueryKey(),
      enabled: !!token && activeTab === "saved",
    },
  });

  const me = useMemo(() => {
    if (!user) return null;
    return { ...user, ...(freshUser as Partial<User> | undefined) } as User;
  }, [user, freshUser]);

  const pickAndUploadAvatar = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploadingAvatar(true);
      const asset = result.assets[0];
      const formData = new FormData();
      const uri = asset.uri;
      const filename = uri.split("/").pop() ?? "avatar.jpg";
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      formData.append("file", { uri, name: filename, type: mimeType } as any);

      const res = await fetch(apiUrl("/uploads/avatar"), {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (user && data.avatarUrl) refreshUser({ ...user, avatarUrl: data.avatarUrl });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void refetchMe();
      }
    } catch {
      /* silent */
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadMyPosts = useCallback(async () => {
    if (!user?.username || !token) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(apiUrl(`/users/${user.username}/posts?limit=50`), {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setMyPosts(data.posts ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.username, token]);

  useEffect(() => {
    void loadMyPosts();
  }, [loadMyPosts]);

  const scrollActiveProfileListToTop = useCallback((tab: ProfileMainTabKey) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (tab === "my") myListRef.current?.scrollToOffset({ offset: 0, animated: false });
        else if (tab === "saved") savedListRef.current?.scrollToOffset({ offset: 0, animated: false });
        else categoriesScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    });
  }, []);

  const onTabChange = useCallback(
    (data: { tabName: string }) => {
      const next = data.tabName as ProfileMainTabKey;
      setActiveTab(next);
      if (Platform.OS !== "web") scrollActiveProfileListToTop(next);
    },
    [scrollActiveProfileListToTop],
  );

  const goToTabWeb = useCallback(
    (key: ProfileMainTabKey) => {
      setActiveTab(key);
      const idx = PROFILE_MAIN_TABS.findIndex((t) => t.key === key);
      if (idx >= 0 && webPagerRef.current) {
        try {
          webPagerRef.current.setPage(idx);
        } catch {
          /* noop */
        }
      }
      scrollActiveProfileListToTop(key);
    },
    [scrollActiveProfileListToTop],
  );

  const onWebPagerPageSelected = useCallback(
    (e: PagerViewOnPage) => {
      const p = e.nativeEvent.position;
      const key = PROFILE_MAIN_TABS[p]?.key;
      if (key) {
        setActiveTab(key);
        scrollActiveProfileListToTop(key);
      }
    },
    [scrollActiveProfileListToTop],
  );

  const scrollProfileToTop = useCallback(() => {
    if (activeTab === "my") {
      myListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else if (activeTab === "saved") {
      savedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      categoriesScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [activeTab]);

  useTabScrollToTop(scrollProfileToTop);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const tabFontSize = windowWidth < 360 ? 10 : windowWidth >= 768 ? 12 : 11;

  const renderMaterialProfileTabBar = useCallback(
    (props: TabBarProps) => (
      <View style={styles.tabBarSurface}>
        <MaterialTabBar
          {...props}
          scrollEnabled={false}
          getLabelText={(name) =>
            PROFILE_MAIN_TABS.find((t) => t.key === (name as ProfileMainTabKey))?.label ?? String(name)
          }
          activeColor={colors.primary}
          inactiveColor={colors.muted}
          labelStyle={[styles.materialTabLabel, { fontSize: tabFontSize }]}
          tabStyle={styles.materialTabItem}
          style={styles.materialTabBar}
          indicatorStyle={styles.tabIndicator}
        />
      </View>
    ),
    [tabFontSize],
  );

  const renderCollapsibleHeader = useCallback(() => {
    if (!me) return null;
    const displayName = me.displayName ?? me.username;
    const initials = displayName.slice(0, 2).toUpperCase();
    const joinYear = new Date(me.createdAt).getFullYear();
    return (
      <View style={styles.collapsibleHeader} pointerEvents="box-none">
        <View style={styles.profileHero}>
          <Pressable onPress={pickAndUploadAvatar} style={styles.avatarRing} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <View style={styles.avatar}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : me.avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(me.avatarUrl)! }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Feather name="camera" size={14} color={colors.surface} />
            </View>
          </Pressable>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.username}>@{me.username}</Text>
          <Text style={styles.joinDate}>Member since {joinYear}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Prayers Shared" value={me.prayersShared ?? 0} />
          <StatCard label="Prayed For" value={me.prayedFor ?? 0} />
          <StatCard label="Saved Scrolls" value={me.savedScrolls ?? 0} />
        </View>
      </View>
    );
  }, [me, uploadingAvatar, pickAndUploadAvatar]);

  if (!user || !me) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const displayName = me.displayName ?? me.username;
  const initials = displayName.slice(0, 2).toUpperCase();
  const joinYear = new Date(me.createdAt).getFullYear();

  const savedPosts = (savedPrayersData as { posts?: Post[] } | undefined)?.posts ?? [];

  const webColumnStyle =
    Platform.OS === "web"
      ? {
          maxWidth: Math.min(LAYOUT.contentMaxWidth, windowWidth),
          width: "100%" as const,
          alignSelf: "center" as const,
        }
      : null;

  const tabletColumnStyle =
    Platform.OS !== "web" && windowWidth >= LAYOUT.tabletMinWidth
      ? {
          maxWidth: LAYOUT.contentMaxWidth,
          width: "100%" as const,
          alignSelf: "center" as const,
        }
      : null;

  const myEmpty = (
    <View style={styles.emptyHistory}>
      <Ionicons name="flame-outline" size={36} color={colors.muted} />
      <Text style={styles.emptyHistoryText}>No prayers shared yet</Text>
      <Text style={styles.emptyHistorySubtext}>Your shared prayers will appear here</Text>
    </View>
  );

  const savedEmpty = (
    <View style={styles.emptyHistory}>
      <Ionicons name="bookmark-outline" size={36} color={colors.muted} />
      <Text style={styles.emptyHistoryText}>{SAVED_POSTS_EMPTY.title}</Text>
      <Text style={styles.emptyHistorySubtext}>{SAVED_POSTS_EMPTY.subtitle}</Text>
    </View>
  );

  const webMyPage = (
    <View style={styles.page} collapsable={false}>
      <FlatList<Post>
        ref={myListRef}
        data={myPosts}
        keyExtractor={(p) => `my-${p.id}`}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <PostCard post={item} feedMediaFocusPostId={activeTab === "my" ? feedMediaFocusPostId : null} />
          </View>
        )}
        ListEmptyComponent={
          loadingPosts ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            myEmpty
          )
        }
        contentContainerStyle={[
          styles.pagerListContent,
          { paddingBottom: botPad + 32 },
          myPosts.length === 0 && !loadingPosts ? { flexGrow: 1, justifyContent: "center" } : null,
        ]}
        onViewableItemsChanged={onMyFeedViewableItemsChanged}
        viewabilityConfig={profileFeedViewabilityConfig}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const webSavedPage = (
    <View style={styles.page} collapsable={false}>
      <FlatList<Post>
        ref={savedListRef}
        data={savedPosts}
        keyExtractor={(p) => `saved-${p.id}`}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <PostCard post={item} feedMediaFocusPostId={activeTab === "saved" ? feedMediaFocusPostId : null} />
          </View>
        )}
        ListEmptyComponent={
          loadingSavedTab ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            savedEmpty
          )
        }
        contentContainerStyle={[
          styles.pagerListContent,
          { paddingBottom: botPad + 32 },
          savedPosts.length === 0 && !loadingSavedTab ? { flexGrow: 1, justifyContent: "center" } : null,
        ]}
        onViewableItemsChanged={onSavedFeedViewableItemsChanged}
        viewabilityConfig={profileFeedViewabilityConfig}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const webCategoriesPage = (
    <View style={styles.page} collapsable={false}>
      <ScrollView
        ref={categoriesScrollRef}
        contentContainerStyle={[styles.catScrollInner, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <PreferredCategoriesContent
          preferredCategories={me.preferredCategories ?? []}
          onOpenPreferences={() => router.push("/settings" as Href)}
        />
      </ScrollView>
    </View>
  );

  const topBar = (
    <View style={styles.topBar}>
      <Text style={styles.screenTitle}>Profile</Text>
      <Pressable
        onPress={() => router.push("/settings" as Href)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={styles.settingsIconBtn}
      >
        <Feather name="settings" size={22} color={colors.primary} />
        {(user?.role === "admin" || user?.role === "moderator") && modPending > 0 && (
          <View style={styles.settingsModBadge} accessibilityLabel={`${modPending} to moderate`}>
            <Text style={styles.settingsModBadgeText}>
              {modPending > 9 ? "9+" : String(modPending)}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  const webHeaderBlock = (
    <>
      <View style={styles.profileHero}>
        <Pressable onPress={pickAndUploadAvatar} style={styles.avatarRing} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <View style={styles.avatar}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : me.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(me.avatarUrl)! }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Feather name="camera" size={14} color={colors.surface} />
          </View>
        </Pressable>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{me.username}</Text>
        <Text style={styles.joinDate}>Member since {joinYear}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Prayers Shared" value={me.prayersShared ?? 0} />
        <StatCard label="Prayed For" value={me.prayedFor ?? 0} />
        <StatCard label="Saved Scrolls" value={me.savedScrolls ?? 0} />
      </View>
    </>
  );

  const webTabRow = (
    <View style={styles.tabBarSurface}>
      <View style={styles.profileTabRow}>
        {PROFILE_MAIN_TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.profileTab, activeTab === key && styles.profileTabActive]}
            onPress={() => goToTabWeb(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === key }}
          >
            <Text
              style={[
                styles.profileTabText,
                { fontSize: tabFontSize },
                activeTab === key && styles.profileTabTextActive,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, webColumnStyle, tabletColumnStyle]}>
      <View style={[styles.fixedTopBar, { paddingTop: topPad + 8 }]}>{topBar}</View>

      {Platform.OS === "web" ? (
        <>
          <View style={styles.webStaticHeader}>{webHeaderBlock}</View>
          {webTabRow}
          <View style={styles.pager}>
            <PagerView
              ref={webPagerRef}
              style={styles.pager}
              initialPage={0}
              onPageSelected={onWebPagerPageSelected}
            >
              {webMyPage}
              {webSavedPage}
              {webCategoriesPage}
            </PagerView>
          </View>
        </>
      ) : (
        <Tabs.Container
          containerStyle={styles.tabsContainer}
          minHeaderHeight={0}
          headerHeight={PROFILE_COLLAPSIBLE_HEADER_HEIGHT}
          initialTabName={PROFILE_MAIN_TABS[0].key}
          renderHeader={renderCollapsibleHeader}
          renderTabBar={renderMaterialProfileTabBar}
          onTabChange={onTabChange}
        >
          <Tabs.Tab name="my" label="My Prayers">
            <Tabs.FlatList
              ref={myListRef}
              data={myPosts}
              keyExtractor={(p: Post) => `my-${p.id}`}
              renderItem={({ item }: { item: Post }) => (
                <View style={{ paddingHorizontal: 20 }}>
                  <PostCard
                    post={item}
                    feedMediaFocusPostId={activeTab === "my" ? feedMediaFocusPostId : null}
                  />
                </View>
              )}
              ListEmptyComponent={
                loadingPosts ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
                ) : (
                  myEmpty
                )
              }
              contentContainerStyle={[
                styles.pagerListContent,
                { paddingBottom: botPad + 32 },
                myPosts.length === 0 && !loadingPosts ? { flexGrow: 1, justifyContent: "center" } : null,
              ]}
              onViewableItemsChanged={onMyFeedViewableItemsChanged}
              viewabilityConfig={profileFeedViewabilityConfig}
              showsVerticalScrollIndicator={false}
            />
          </Tabs.Tab>
          <Tabs.Tab name="saved" label="Saved">
            <Tabs.FlatList
              ref={savedListRef}
              data={savedPosts}
              keyExtractor={(p: Post) => `saved-${p.id}`}
              renderItem={({ item }: { item: Post }) => (
                <View style={{ paddingHorizontal: 20 }}>
                  <PostCard
                    post={item}
                    feedMediaFocusPostId={activeTab === "saved" ? feedMediaFocusPostId : null}
                  />
                </View>
              )}
              ListEmptyComponent={
                loadingSavedTab ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
                ) : (
                  savedEmpty
                )
              }
              contentContainerStyle={[
                styles.pagerListContent,
                { paddingBottom: botPad + 32 },
                savedPosts.length === 0 && !loadingSavedTab ? { flexGrow: 1, justifyContent: "center" } : null,
              ]}
              onViewableItemsChanged={onSavedFeedViewableItemsChanged}
              viewabilityConfig={profileFeedViewabilityConfig}
              showsVerticalScrollIndicator={false}
            />
          </Tabs.Tab>
          <Tabs.Tab name="categories" label="Categories">
            <Tabs.ScrollView
              ref={categoriesScrollRef}
              contentContainerStyle={[styles.catScrollInner, { paddingBottom: botPad + 32 }]}
              showsVerticalScrollIndicator={false}
            >
              <PreferredCategoriesContent
                preferredCategories={me.preferredCategories ?? []}
                onOpenPreferences={() => router.push("/settings" as Href)}
              />
            </Tabs.ScrollView>
          </Tabs.Tab>
        </Tabs.Container>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  fixedTopBar: {
    paddingHorizontal: 20,
    backgroundColor: colors.cream,
    zIndex: 1,
  },
  webStaticHeader: {
    paddingHorizontal: 20,
    gap: 24,
    paddingBottom: 16,
    backgroundColor: colors.cream,
  },
  collapsibleHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 24,
    backgroundColor: colors.cream,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  settingsIconBtn: {
    position: "relative",
  },
  settingsModBadge: {
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
  settingsModBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: colors.surface,
  },
  screenTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  profileHero: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 4,
    marginBottom: 4,
  },
  avatar: {
    flex: 1,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 28,
    color: colors.accent,
  },
  displayName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  username: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.cream,
  },
  joinDate: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
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
  profileTabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  profileTab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  profileTabActive: {
    borderBottomColor: colors.primary,
  },
  profileTabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    textAlign: "center",
  },
  profileTabTextActive: {
    color: colors.primary,
  },
  tabsContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pagerListContent: {
    paddingTop: 8,
  },
  catScrollInner: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyHistoryText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  emptyHistorySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
});
