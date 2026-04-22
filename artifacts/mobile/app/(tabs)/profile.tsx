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
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe, getGetMeQueryKey, useGetSavedPrayers, getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import type { Post, User } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { PreferredCategoriesContent } from "@/components/PreferredCategoriesContent";
import { StatCard } from "@/components/StatCard";
import colors from "@/constants/colors";
import { PROFILE_MAIN_TABS } from "@/constants/profileTabs";
import { SAVED_POSTS_EMPTY } from "@/constants/savedList";
import { useAuth } from "@/context/auth";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { apiUrl, authHeaders } from "@/lib/api";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";

type ProfileRow =
  | { kind: "header" }
  | { kind: "loading" }
  | { kind: "categories" }
  | { kind: "empty"; tab: "my" | "saved" }
  | Post;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, refreshUser, token } = useAuth();
  const listRef = useRef<FlatList<ProfileRow>>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileTab, setProfileTab] = useState<"my" | "saved" | "categories">("my");

  const { data: freshUser, refetch: refetchMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, staleTime: 0 },
  });

  useEffect(() => {
    if (freshUser) refreshUser(freshUser as User);
  }, [freshUser, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      if (token) refetchMe();
    }, [token, refetchMe]),
  );

  const { data: savedPrayersData, isLoading: loadingSavedTab } = useGetSavedPrayers({
    query: {
      queryKey: getGetSavedPrayersQueryKey(),
      enabled: !!token && profileTab === "saved",
    },
  });

  const me = useMemo(() => {
    if (!user) return null;
    return { ...user, ...(freshUser as Partial<User> | undefined) } as User;
  }, [user, freshUser]);

  const pickAndUploadAvatar = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        return;
      }
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
        if (user && data.avatarUrl) {
          refreshUser({ ...user, avatarUrl: data.avatarUrl });
        }
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

  const scrollProfileToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  useTabScrollToTop(scrollProfileToTop);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

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

  const listRows: ProfileRow[] = (() => {
    const head: ProfileRow[] = [{ kind: "header" }];
    if (profileTab === "categories") {
      return [...head, { kind: "categories" }];
    }
    if (profileTab === "my") {
      if (loadingPosts) return [...head, { kind: "loading" }];
      if (myPosts.length === 0) return [...head, { kind: "empty", tab: "my" }];
      return [...head, ...myPosts];
    }
    if (loadingSavedTab) return [...head, { kind: "loading" }];
    if (savedPosts.length === 0) return [...head, { kind: "empty", tab: "saved" }];
    return [...head, ...savedPosts];
  })();

  const renderHero = () => (
    <View style={[styles.headerContainer, { paddingTop: topPad + 8 }]}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Profile</Text>
        <Pressable
          onPress={() => router.push("/settings" as Href)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Feather name="settings" size={22} color={colors.primary} />
        </Pressable>
      </View>

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

  const tabFontSize = windowWidth < 360 ? 10 : windowWidth >= 768 ? 12 : 11;

  const keyExtractor = (item: ProfileRow, index: number) => {
    if (typeof item === "object" && item !== null && "kind" in item) {
      if (item.kind === "header") return "header";
      if (item.kind === "loading") return "loading";
      if (item.kind === "categories") return "categories";
      if (item.kind === "empty") return `empty-${item.tab}`;
    }
    return `post-${(item as Post).id}-${index}`;
  };

  const renderItem = ({ item }: { item: ProfileRow }) => {
    if ("kind" in item && item.kind === "header") {
      return (
        <View style={styles.headerBlock}>
          {renderHero()}
          <View style={styles.tabBarSurface}>
            <View style={styles.profileTabRow}>
              {PROFILE_MAIN_TABS.map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.profileTab, profileTab === key && styles.profileTabActive]}
                  onPress={() => setProfileTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: profileTab === key }}
                >
                  <Text
                    style={[
                      styles.profileTabText,
                      { fontSize: tabFontSize },
                      profileTab === key && styles.profileTabTextActive,
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
        </View>
      );
    }
    if ("kind" in item && item.kind === "loading") {
      return <ActivityIndicator color={colors.accent} style={{ marginTop: 24, marginBottom: 24 }} />;
    }
    if ("kind" in item && item.kind === "categories") {
      return (
        <View style={styles.categoriesTabEmpty}>
          <PreferredCategoriesContent
            preferredCategories={me.preferredCategories ?? []}
            onOpenPreferences={() => router.push("/settings" as Href)}
          />
        </View>
      );
    }
    if ("kind" in item && item.kind === "empty") {
      return item.tab === "my" ? (
        <View style={styles.emptyHistory}>
          <Ionicons name="flame-outline" size={36} color={colors.muted} />
          <Text style={styles.emptyHistoryText}>No prayers shared yet</Text>
          <Text style={styles.emptyHistorySubtext}>Your shared prayers will appear here</Text>
        </View>
      ) : (
        <View style={styles.emptyHistory}>
          <Ionicons name="bookmark-outline" size={36} color={colors.muted} />
          <Text style={styles.emptyHistoryText}>{SAVED_POSTS_EMPTY.title}</Text>
          <Text style={styles.emptyHistorySubtext}>{SAVED_POSTS_EMPTY.subtitle}</Text>
        </View>
      );
    }
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <PostCard post={item as Post} />
      </View>
    );
  };

  const webColumnStyle =
    Platform.OS === "web"
      ? {
          maxWidth: Math.min(720, windowWidth),
          width: "100%" as const,
          alignSelf: "center" as const,
        }
      : null;

  return (
    <FlatList
      ref={listRef}
      data={listRows}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={[styles.listContent, { paddingBottom: botPad + 100 }, webColumnStyle]}
      style={[styles.flex, webColumnStyle]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  listContent: { flexGrow: 1 },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  headerBlock: {
    backgroundColor: colors.cream,
  },
  headerContainer: {
    paddingHorizontal: 20,
    gap: 24,
    paddingBottom: 16,
    backgroundColor: colors.cream,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
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
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
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
  categoriesTabEmpty: {
    width: "100%",
    paddingVertical: 40,
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
