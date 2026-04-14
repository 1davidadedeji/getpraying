import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
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
import { useGetNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notificationTitle(n: Notification & { type: string }): string {
  switch (n.type) {
    case "prayer":
      return n.actorUsername ? `${n.actorUsername} prayed with you` : "Someone prayed with you";
    case "prayer_milestone":
      return "Your prayer is spreading";
    case "saved":
      return "Someone saved your prayer";
    case "reminder":
      return "Prayer reminder";
    case "category_new":
      return n.category ? `New in library: ${n.category}` : "Library update";
    case "post_approved":
      return "Prayer approved";
    case "post_declined":
      return "Prayer not approved";
    case "system":
      return "Update";
    default:
      return "Notification";
  }
}

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification & { type: string };
  onPress: () => void;
}) {
  const icon =
    item.type === "prayer" || item.type === "prayer_milestone"
      ? "flame"
      : item.type === "saved"
        ? "bookmark"
        : item.type === "reminder"
          ? "time-outline"
          : item.type === "post_approved"
            ? "checkmark-circle"
            : item.type === "post_declined"
              ? "alert-circle"
              : "notifications-outline";
  const iconColor =
    item.type === "prayer" || item.type === "prayer_milestone"
      ? colors.flame
      : item.type === "saved"
        ? colors.primary
        : item.type === "post_declined"
          ? colors.danger
          : item.type === "post_approved"
            ? colors.success
            : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifCard,
        !item.isRead && styles.notifCardUnread,
        pressed && styles.notifCardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={notificationTitle(item)}
    >
      <View style={[styles.notifIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifTitle}>{notificationTitle(item)}</Text>
        <Text style={styles.notifBody} numberOfLines={2}>{item.message}</Text>
        {item.postPreview && (
          <Text style={styles.notifPreview} numberOfLines={1}>
            "{item.postPreview}"
          </Text>
        )}
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
      {item.postId && (
        <Ionicons name="chevron-forward" size={14} color={colors.muted} style={styles.chevron} />
      )}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isFetching } = useGetNotifications();
  const { mutate: markAll } = useMarkAllNotificationsRead();
  const notifications: Notification[] = (data as any)?.notifications ?? [];
  const { token } = useAuth();
  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handlePress = (item: Notification) => {
    if (!item.isRead && token) {
      const base = getApiBaseUrl();
      fetch(`${base}/api/notifications/${item.id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    if (item.postId) {
      router.push(`/post/${item.postId}`);
    }
  };

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <NotificationItem item={item} onPress={() => handlePress(item)} />
      )}
      ListHeaderComponent={
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={() => markAll()}
              style={styles.markReadBtn}
            >
              <Feather name="check-circle" size={16} color={colors.accent} />
              <Text style={styles.markReadText}>Mark all read</Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySubtitle}>No notifications yet</Text>
          </View>
        )
      }
      contentContainerStyle={[
        styles.list,
        { paddingBottom: 100 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 16,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
  },
  unreadLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  markReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markReadText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.accent,
  },
  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifCardUnread: {
    borderColor: colors.accent,
    backgroundColor: "#FFFBF2",
  },
  notifCardPressed: {
    opacity: 0.85,
  },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  notifBody: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  notifPreview: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 2,
  },
  notifTime: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 5,
    flexShrink: 0,
  },
  chevron: {
    marginTop: 10,
    flexShrink: 0,
  },
  loader: { marginTop: 40 },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
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
