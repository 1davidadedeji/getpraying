import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const { user: me, token } = useAuth();
  const [allUsers, setAllUsers] = useState<
    { id: number; username: string; displayName: string | null; role: string; isBanned?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const listPadB = Math.round(clamp(40 * uiScale, 32, 48));
  const headerPadT = Math.round(Platform.OS === "web" ? clamp(12 * uiScale, 10, 14) : clamp(4 * uiScale, 4, 6));
  const fsHint = Math.round(clamp(13 * uiScale, 12, 15));
  const lhHint = Math.round(fsHint * 1.35);
  const hintMb = Math.round(clamp(12 * uiScale, 10, 14));
  const searchRad = Math.round(clamp(32 * uiScale, 28, 36));
  const searchPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const searchPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const searchMb = Math.round(clamp(14 * uiScale, 12, 16));
  const searchIcn = Math.round(clamp(16 * uiScale, 14, 18));
  const searchIcnMr = Math.round(clamp(8 * uiScale, 6, 10));
  const fsSearch = Math.round(clamp(14 * uiScale, 13, 16));
  const rowGap = Math.round(clamp(10 * uiScale, 8, 12));
  const rowPad = Math.round(clamp(12 * uiScale, 10, 14));
  const rowRad = Math.round(clamp(16 * uiScale, 14, 18));
  const rowMb = Math.round(clamp(10 * uiScale, 8, 12));
  const avSz = Math.round(clamp(36 * uiScale, 32, 40));
  const avFs = Math.round(clamp(14 * uiScale, 13, 16));
  const fsName = Math.round(clamp(15 * uiScale, 14, 16));
  const fsMeta = Math.round(clamp(12 * uiScale, 11, 13));
  const roleGap = Math.round(clamp(6 * uiScale, 5, 8));
  const iconBtnSz = Math.round(clamp(36 * uiScale, 32, 40));
  const iconBtnRad = Math.round(clamp(10 * uiScale, 8, 12));
  const rowIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const loaderMt = Math.round(clamp(40 * uiScale, 32, 48));
  const emptyPt = Math.round(clamp(40 * uiScale, 32, 48));
  const fsEmpty = Math.round(clamp(14 * uiScale, 13, 16));

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/admin/users?limit=200", { token });
      const data = await res.json().catch(() => ({}));
      setAllUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      showAppAlert({ title: "Could not load users", message: "Check your connection." });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = search.trim()
    ? allUsers.filter((u) => {
        const q = search.trim().toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName ?? "").toLowerCase().includes(q)
        );
      })
    : allUsers;

  const changeRole = (userId: number, username: string, role: "user" | "moderator" | "admin") => {
    showAppAlert({
      title: `Set ${username} as ${role}?`,
      message: "They will get the matching permissions the next time they use the app.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: async () => {
            if (!token) return;
            try {
              const res = await apiFetch(`/admin/users/${userId}/role`, {
                method: "POST",
                token,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                showAppAlert({ title: "Update failed", message: data?.error ?? "Try again." });
                return;
              }
              await load();
            } catch {
              showAppAlert({ title: "Update failed", message: "Network error. Try again." });
            }
          },
        },
      ],
    });
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (me?.id === userId) return;
    showAppAlert({
      title: `Delete ${username}?`,
      message: "This permanently removes the account and associated content.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              const res = await apiFetch(`/admin/users/${userId}`, {
                method: "DELETE",
                token,
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                showAppAlert({ title: "Delete failed", message: (data as { error?: string }).error ?? "Try again." });
                return;
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch {
              showAppAlert({ title: "Delete failed", message: "Network error." });
            }
          },
        },
      ],
    });
  };

  const handleBanToggle = (userId: number, username: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? "unban" : "ban";
    showAppAlert({
      title: `${currentlyBanned ? "Unban" : "Ban"} ${username}?`,
      message: currentlyBanned
        ? "This user will regain access to the app."
        : "This user will be blocked from using the app.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: currentlyBanned ? "Unban" : "Ban",
          style: currentlyBanned ? "default" : "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              const res = await apiFetch(`/admin/users/${userId}/${action}`, {
                method: "POST",
                token,
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                showAppAlert({ title: `${action} failed`, message: data?.error ?? "Try again." });
                return;
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch {
              showAppAlert({ title: `${action} failed`, message: "Network error. Try again." });
            }
          },
        },
      ],
    });
  };

  const roleColor = (role: string) => {
    if (role === "admin") return colors.flame;
    if (role === "moderator") return colors.accent;
    return colors.muted;
  };

  return (
    <FlatList
      data={filteredUsers}
      keyExtractor={(u) => String(u.id)}
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={[styles.list, { paddingHorizontal: gutter, paddingBottom: botPad + listPadB }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ paddingTop: headerPadT }}>
          <Text style={[styles.usersHint, { fontSize: fsHint, lineHeight: lhHint, marginBottom: hintMb }]}>
            Admins can promote to moderator or admin, or demote with User (regular member).
          </Text>
          <View
            style={[
              styles.searchRow,
              {
                borderRadius: searchRad,
                paddingHorizontal: searchPadH,
                paddingVertical: searchPadV,
                marginBottom: searchMb,
              },
            ]}
          >
            <Feather name="search" size={searchIcn} color={colors.muted} style={{ marginRight: searchIcnMr }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by username or display name…"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { fontSize: fsSearch }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} style={{ padding: 4 }}>
                <Feather name="x" size={searchIcn} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      }
      renderItem={({ item: u }) => (
        <View
          style={[
            styles.userRow,
            {
              gap: rowGap,
              padding: rowPad,
              borderRadius: rowRad,
              marginBottom: rowMb,
            },
          ]}
        >
          <View style={[styles.userAvatar, { width: avSz, height: avSz, borderRadius: avSz / 2 }]}>
            <Text style={[styles.userAvatarText, { fontSize: avFs }]}>
              {(u.displayName ?? u.username)[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.userName, { fontSize: fsName }]} numberOfLines={1}>
              {u.displayName ?? u.username}
            </Text>
            <Text style={[styles.userMeta, { fontSize: fsMeta }]} numberOfLines={1}>
              @{u.username} · <Text style={{ color: roleColor(u.role) }}>{u.role}</Text>
            </Text>
          </View>
          <View style={[styles.roleBtns, { gap: roleGap }]}>
            <Pressable
              style={[
                styles.iconBtn,
                {
                  width: iconBtnSz,
                  height: iconBtnSz,
                  borderRadius: iconBtnRad,
                },
                u.role === "user" && styles.iconBtnOn,
              ]}
              onPress={() => changeRole(u.id, u.username, "user")}
              accessibilityLabel="Set role user"
            >
              <Ionicons name="person-outline" size={rowIcn} color={u.role === "user" ? colors.surface : colors.primary} />
            </Pressable>
            <Pressable
              style={[
                styles.iconBtn,
                {
                  width: iconBtnSz,
                  height: iconBtnSz,
                  borderRadius: iconBtnRad,
                },
                u.role === "moderator" && styles.iconBtnOn,
              ]}
              onPress={() => changeRole(u.id, u.username, "moderator")}
              accessibilityLabel="Set role moderator"
            >
              <Ionicons
                name="shield-half-outline"
                size={rowIcn}
                color={u.role === "moderator" ? colors.surface : colors.primary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.iconBtn,
                {
                  width: iconBtnSz,
                  height: iconBtnSz,
                  borderRadius: iconBtnRad,
                },
                u.role === "admin" && styles.iconBtnOn,
              ]}
              onPress={() => changeRole(u.id, u.username, "admin")}
              accessibilityLabel="Set role admin"
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={rowIcn}
                color={u.role === "admin" ? colors.surface : colors.primary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.iconBtn,
                {
                  width: iconBtnSz,
                  height: iconBtnSz,
                  borderRadius: iconBtnRad,
                },
                (u as { isBanned?: boolean }).isBanned && styles.banOn,
              ]}
              onPress={() => handleBanToggle(u.id, u.username, !!(u as { isBanned?: boolean }).isBanned)}
              accessibilityLabel="Ban or unban"
            >
              <Ionicons
                name="ban-outline"
                size={rowIcn}
                color={(u as { isBanned?: boolean }).isBanned ? colors.surface : colors.danger}
              />
            </Pressable>
            {me?.id !== u.id ? (
              <Pressable
                style={[
                  styles.iconBtn,
                  {
                    width: iconBtnSz,
                    height: iconBtnSz,
                    borderRadius: iconBtnRad,
                  },
                ]}
                onPress={() => handleDeleteUser(u.id, u.username)}
                accessibilityLabel="Delete user"
              >
                <Ionicons name="trash-outline" size={rowIcn} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.accent} style={[styles.loader, { marginTop: loaderMt }]} />
        ) : (
          <View style={[styles.emptyState, { paddingTop: emptyPt }]}>
            <Text style={[styles.emptySubtitle, { fontSize: fsEmpty }]}>
              {search ? "No users match your search." : "No users returned."}
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 8,
  },
  usersHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatar: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userAvatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
  },
  userName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.text,
  },
  userMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 2,
  },
  roleBtns: {
    flexDirection: "row",
    flexShrink: 0,
  },
  iconBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  banOn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  loader: {},
  emptyState: {
    alignItems: "center",
  },
  emptySubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
});
