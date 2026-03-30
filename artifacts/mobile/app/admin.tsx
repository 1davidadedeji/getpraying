import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApprovePost,
  useDeclinePost,
  useGetAdminStats,
  useGetPendingPosts,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import colors from "@/constants/colors";

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBadge, { borderColor: `${color}40` }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PendingPostCard({
  post,
  onModerated,
}: {
  post: Post;
  onModerated: () => void;
}) {
  const { mutate: approve, isPending: isApproving } = useApprovePost();
  const { mutate: decline, isPending: isDeclining } = useDeclinePost();

  const handleApprove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    approve({ postId: post.id }, { onSuccess: onModerated });
  };

  const handleDecline = () => {
    Alert.alert("Decline Prayer", "Decline this prayer post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          decline({ postId: post.id }, { onSuccess: onModerated });
        },
      },
    ]);
  };

  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>
            {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.postAuthor}>{authorName}</Text>
        {post.category && (
          <View style={styles.postCategoryBadge}>
            <Text style={styles.postCategoryText}>{post.category}</Text>
          </View>
        )}
      </View>
      <Text style={styles.postContent} numberOfLines={4}>
        {post.content}
      </Text>
      <View style={styles.postActions}>
        <Pressable
          style={styles.approveBtn}
          onPress={handleApprove}
          disabled={isApproving || isDeclining}
        >
          {isApproving ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <>
              <Feather name="check" size={16} color={colors.surface} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={styles.declineBtn}
          onPress={handleDecline}
          disabled={isApproving || isDeclining}
        >
          {isDeclining ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <>
              <Feather name="x" size={16} color={colors.danger} />
              <Text style={styles.declineBtnText}>Decline</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { data: pending, isLoading, refetch, isFetching } = useGetPendingPosts({});
  const { data: statsData } = useGetAdminStats();

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const stats = statsData as any;
  const pendingPosts: Post[] = (pending as any)?.posts ?? [];

  return (
    <FlatList
      data={pendingPosts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <PendingPostCard post={item} onModerated={refetch} />
      )}
      ListHeaderComponent={
        <View style={{ paddingTop: Platform.OS === "web" ? 20 : 8 }}>
          {stats && (
            <View style={styles.statsRow}>
              <StatBadge
                label="Pending"
                value={(stats as any).pendingPosts ?? 0}
                color={colors.accent}
              />
              <StatBadge
                label="Approved"
                value={(stats as any).approvedPosts ?? 0}
                color={colors.success}
              />
              <StatBadge
                label="Users"
                value={(stats as any).totalUsers ?? 0}
                color={colors.primary}
              />
            </View>
          )}
          <Text style={styles.sectionTitle}>Pending Review</Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySubtitle}>No pending prayer posts</Text>
          </View>
        )
      }
      contentContainerStyle={[styles.list, { paddingBottom: botPad + 40 }]}
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
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  statBadge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 3,
    borderWidth: 1.5,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: colors.accent,
  },
  postAuthor: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  postCategoryBadge: {
    backgroundColor: colors.flameDim,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  postCategoryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: colors.flame,
    textTransform: "capitalize",
  },
  postContent: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  postActions: {
    flexDirection: "row",
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.success,
  },
  approveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.surface,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  declineBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.danger,
  },
  loader: { marginTop: 40 },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.primary,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
});
