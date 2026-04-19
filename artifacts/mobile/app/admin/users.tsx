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
import { apiUrl, authHeaders } from "@/lib/api";

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { user: me, token } = useAuth();
  const [allUsers, setAllUsers] = useState<
    { id: number; username: string; displayName: string | null; role: string; isBanned?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/admin/users?limit=200"), {
        headers: authHeaders(token),
      });
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
              const res = await fetch(apiUrl(`/admin/users/${userId}/role`), {
                method: "POST",
                headers: authHeaders(token, { "Content-Type": "application/json" }),
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
              const res = await fetch(apiUrl(`/admin/users/${userId}`), {
                method: "DELETE",
                headers: authHeaders(token),
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
              const res = await fetch(apiUrl(`/admin/users/${userId}/${action}`), {
                method: "POST",
                headers: authHeaders(token),
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
      contentContainerStyle={[styles.list, { paddingBottom: botPad + 40 }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ paddingTop: Platform.OS === "web" ? 12 : 4 }}>
          <Text style={styles.usersHint}>
            Admins can promote to moderator or admin, or demote with User (regular member).
          </Text>
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by username or display name…"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} style={{ padding: 4 }}>
                <Feather name="x" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      }
      renderItem={({ item: u }) => (
        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(u.displayName ?? u.username)[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {u.displayName ?? u.username}
            </Text>
            <Text style={styles.userMeta} numberOfLines={1}>
              @{u.username} · <Text style={{ color: roleColor(u.role) }}>{u.role}</Text>
            </Text>
          </View>
          <View style={styles.roleBtns}>
            <Pressable
              style={[styles.iconBtn, u.role === "user" && styles.iconBtnOn]}
              onPress={() => changeRole(u.id, u.username, "user")}
              accessibilityLabel="Set role user"
            >
              <Ionicons name="person-outline" size={18} color={u.role === "user" ? colors.surface : colors.primary} />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, u.role === "moderator" && styles.iconBtnOn]}
              onPress={() => changeRole(u.id, u.username, "moderator")}
              accessibilityLabel="Set role moderator"
            >
              <Ionicons
                name="shield-half-outline"
                size={18}
                color={u.role === "moderator" ? colors.surface : colors.primary}
              />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, u.role === "admin" && styles.iconBtnOn]}
              onPress={() => changeRole(u.id, u.username, "admin")}
              accessibilityLabel="Set role admin"
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={u.role === "admin" ? colors.surface : colors.primary}
              />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, (u as { isBanned?: boolean }).isBanned && styles.banOn]}
              onPress={() => handleBanToggle(u.id, u.username, !!(u as { isBanned?: boolean }).isBanned)}
              accessibilityLabel="Ban or unban"
            >
              <Ionicons
                name="ban-outline"
                size={18}
                color={(u as { isBanned?: boolean }).isBanned ? colors.surface : colors.danger}
              />
            </Pressable>
            {me?.id !== u.id ? (
              <Pressable
                style={styles.iconBtn}
                onPress={() => handleDeleteUser(u.id, u.username)}
                accessibilityLabel="Delete user"
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptySubtitle}>
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  usersHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userAvatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.accent,
  },
  userName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  userMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  roleBtns: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
  loader: { marginTop: 40 },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptySubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
});
