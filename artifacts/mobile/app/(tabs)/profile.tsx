import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { apiUrl, authHeaders } from "@/lib/api";
import { useTabScrollToTop } from "@/hooks/useTabScrollToTop";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser, token } = useAuth();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const { data: freshUser, refetch: refetchMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, staleTime: 0 },
  });

  useEffect(() => {
    if (freshUser) refreshUser(freshUser as any);
  }, [freshUser]);

  useFocusEffect(
    useCallback(() => {
      if (token) refetchMe();
    }, [token, refetchMe]),
  );

  const pickAndUploadAvatar = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        showAppAlert({ title: "Permission needed", message: "Allow photo access to set your profile picture." });
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
      } else {
        const err = await res.json().catch(() => ({}));
        showAppAlert({ title: "Upload failed", message: (err as any).error ?? "Please try again." });
      }
    } catch {
      showAppAlert({ title: "Upload failed", message: "Check your connection and try again." });
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
    } catch { /* silent */ } finally {
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

  const handleDeleteAccount = () => {
    showAppAlert({
      title: "Delete account?",
      message:
        "This permanently removes your profile, prayers, and saved items. This cannot be undone.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setDeletingAccount(true);
            try {
              const res = await fetch(apiUrl("/auth/account"), {
                method: "DELETE",
                headers: authHeaders(token),
              });
              if (res.ok) {
                queryClient.clear();
                await logout();
              } else {
                const err = await res.json().catch(() => ({}));
                showAppAlert({
                  title: "Could not delete account",
                  message: (err as { error?: string }).error ?? "Please try again.",
                });
              }
            } catch {
              showAppAlert({ title: "Could not delete account", message: "Check your connection." });
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    });
  };

  const handleLogout = () => {
    showAppAlert({
      title: "Sign out",
      message: "You'll need to sign in again to view your feed.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            queryClient.clear();
            await logout();
          },
        },
      ],
    });
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const displayName = user.displayName ?? user.username;
  const initials = displayName.slice(0, 2).toUpperCase();
  const joinYear = new Date(user.createdAt).getFullYear();

  const profileHeader = (
    <View style={[styles.headerContainer, { paddingTop: topPad + 8 }]}>
      <View style={styles.profileHero}>
        <Pressable onPress={pickAndUploadAvatar} style={styles.avatarRing} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <View style={styles.avatar}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : user.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(user.avatarUrl)! }} style={styles.avatar} />
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
        <Text style={styles.username}>@{user.username}</Text>

        <Text style={styles.joinDate}>Member since {joinYear}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Prayers Shared" value={user.prayersShared ?? 0} />
        <StatCard label="Prayed For" value={user.prayedFor ?? 0} />
        <StatCard label="Saved Scrolls" value={user.savedScrolls ?? 0} />
      </View>
      <Text style={styles.statLegend}>
        Prayed For goes up when someone else prays on your posts (not when you pray on your own).
      </Text>

      {(user.preferredCategories ?? []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Prayer Categories</Text>
          <View style={styles.chips}>
            {(user.preferredCategories ?? []).map((cat) => (
              <View key={cat} style={styles.chip}>
                <Text style={styles.chipText}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={() => router.push("/onboarding")}>
            <Feather name="settings" size={18} color={colors.primary} />
            <Text style={styles.menuItemText}>Prayer preferences</Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>

          {(user.role === "admin" || user.role === "moderator") && (
            <Pressable style={styles.menuItem} onPress={() => router.push("/admin")}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.accent }]}>
                {user.role === "admin" ? "Admin panel" : "Moderation"}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          )}

          <Pressable
            style={styles.menuItem}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>
              {deletingAccount ? "Deleting…" : "Delete account"}
            </Text>
          </Pressable>

          <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Prayer History</Text>
        {loadingPosts && (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      data={loadingPosts ? [] : myPosts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 20 }}>
          <PostCard post={item} />
        </View>
      )}
      ListHeaderComponent={profileHeader}
      ListEmptyComponent={
        !loadingPosts ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="flame-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyHistoryText}>No prayers shared yet</Text>
            <Text style={styles.emptyHistorySubtext}>Your shared prayers will appear here</Text>
          </View>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: botPad + 100 }}
      style={styles.flex}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  headerContainer: {
    paddingHorizontal: 20,
    gap: 24,
    paddingBottom: 8,
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
  statLegend: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: -4,
  },
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
  statValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: colors.flameDim,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.flame,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.text,
    flex: 1,
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
