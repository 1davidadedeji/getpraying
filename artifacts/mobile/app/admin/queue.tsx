import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { PostMediaBlock } from "@/components/PostMedia";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApprovePost,
  useDeclinePost,
  useGetAdminStats,
  getGetAdminStatsQueryKey,
  getGetModeratedPostsQueryKey,
  useGetModeratedPosts,
  useGetPendingPosts,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

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
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const handleApprove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    approve({ postId: post.id }, { onSuccess: onModerated });
  };

  const submitDecline = () => {
    const r = declineReason.trim();
    if (r.length < 3) {
      showAppAlert({
        title: "Reason required",
        message: "Authors see this in their alerts. Use at least 3 characters.",
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    decline(
      { postId: post.id, data: { reason: r } },
      {
        onSuccess: () => {
          setDeclineOpen(false);
          setDeclineReason("");
          onModerated();
        },
        onError: (e: unknown) =>
          showAppAlert({ title: "Decline failed", message: getApiErrorMessage(e, "Try again") }),
      },
    );
  };

  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  return (
    <View style={styles.postCard}>
      <Modal visible={declineOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setDeclineOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Decline post</Text>
            <Text style={styles.modalHint}>
              The author will get an alert with this reason. Be clear and respectful.
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Reason for declining…"
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setDeclineOpen(false);
                  setDeclineReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, isDeclining && styles.btnDisabledInline]}
                onPress={submitDecline}
                disabled={isDeclining}
              >
                {isDeclining ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Decline post</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={styles.postThumb}
        compact
        thumbnail
      />
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
          onPress={() => setDeclineOpen(true)}
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

type ModActivityRow = {
  moderatorId: number;
  username: string | null;
  displayName: string | null;
  role: string | null;
  actions: number;
};

function ModActivityCard({ token }: { token: string | null }) {
  const [rows, setRows] = useState<ModActivityRow[]>([]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(apiUrl("/admin/moderators/activity"), {
          headers: authHeaders(token),
        });
        const data = await res.json().catch(() => ({}));
        setRows(Array.isArray(data.moderators) ? data.moderators : []);
      } catch {
        setRows([]);
      }
    })();
  }, [token]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.activityCard}>
      <Text style={styles.activityTitle}>Moderator activity</Text>
      <Text style={styles.activityHint}>Recent approve/decline actions recorded on posts.</Text>
      {rows.map((r) => (
        <View key={r.moderatorId} style={styles.activityRow}>
          <Text style={styles.activityName}>
            {r.displayName ?? r.username ?? `User #${r.moderatorId}`}
          </Text>
          <Text style={styles.activityCount}>{r.actions} actions</Text>
        </View>
      ))}
    </View>
  );
}

function ReviewedPostCard({
  post,
  token,
  onChanged,
}: {
  post: Post;
  token: string | null;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  const requeue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/admin/posts/${post.id}/requeue`), {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({ title: "Could not re-queue", message: data?.error ?? "Try again." });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>
            {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.postAuthor}>{authorName}</Text>
        <View
          style={[
            styles.statusPill,
            post.status === "approved" ? styles.statusApproved : styles.statusDeclined,
          ]}
        >
          <Text style={styles.statusPillText}>{post.status}</Text>
        </View>
      </View>
      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={styles.postThumb}
        compact
        thumbnail
      />
      <Text style={styles.postContent} numberOfLines={5}>
        {post.content}
      </Text>
      {post.status === "approved" ? (
        <Pressable
          style={[styles.requeueBtn, loading && styles.btnDisabledInline]}
          onPress={requeue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.requeueBtnText}>Return to moderation queue</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function AdminQueueScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator" || isAdmin;
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const pendingQ = useGetPendingPosts({});
  const { data: statsData } = useGetAdminStats({
    query: {
      queryKey: getGetAdminStatsQueryKey(),
      enabled: isAdmin,
    },
  });

  const moderatedQ = useGetModeratedPosts(
    {},
    {
      query: {
        queryKey: getGetModeratedPostsQueryKey({}),
        enabled: isAdmin && tab === "reviewed",
      },
    },
  );

  if (!isModerator) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.muted} />
        <Text style={styles.accessDeniedTitle}>Restricted</Text>
        <Text style={styles.accessDeniedText}>
          Moderators and admins can open this screen from the feed or profile.
        </Text>
      </View>
    );
  }

  const stats = statsData as any;
  const pendingPosts: Post[] = (pendingQ.data as any)?.posts ?? [];
  const reviewedPosts: Post[] = (moderatedQ.data as any)?.posts ?? [];
  const listData = tab === "pending" ? pendingPosts : reviewedPosts;
  const isLoading = tab === "pending" ? pendingQ.isLoading : moderatedQ.isLoading;
  const isFetching = tab === "pending" ? pendingQ.isFetching : moderatedQ.isFetching;
  const refetch =
    tab === "pending"
      ? pendingQ.refetch
      : () => {
          void moderatedQ.refetch();
        };

  return (
    <FlatList
      data={listData}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) =>
        tab === "pending" ? (
          <PendingPostCard
            post={item}
            onModerated={() => {
              void pendingQ.refetch();
              void queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
            }}
          />
        ) : (
          <ReviewedPostCard
            post={item}
            token={token}
            onChanged={() => {
              void moderatedQ.refetch();
              void queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
            }}
          />
        )
      }
      ListHeaderComponent={
        <View style={{ paddingTop: Platform.OS === "web" ? 20 : 8 }}>
          {isAdmin ? (
            <>
              <ModActivityCard token={token} />
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
              <View style={styles.tabRow}>
                <Pressable
                  style={[styles.tabBtn, tab === "pending" && styles.tabBtnOn]}
                  onPress={() => setTab("pending")}
                >
                  <Text style={[styles.tabBtnText, tab === "pending" && styles.tabBtnTextOn]}>
                    Pending
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabBtn, tab === "reviewed" && styles.tabBtnOn]}
                  onPress={() => setTab("reviewed")}
                >
                  <Text style={[styles.tabBtnText, tab === "reviewed" && styles.tabBtnTextOn]}>
                    Reviewed
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.modOnlyTitle}>Pending review</Text>
          )}
          <Text style={styles.sectionTitle}>
            {tab === "pending" ? "Queue" : "Recently moderated"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>
              {tab === "pending" ? "All clear" : "Nothing here yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === "pending"
                ? "No pending prayer posts"
                : "Approved and declined posts show here for admins."}
            </Text>
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
      ListFooterComponent={null}
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
    borderRadius: 32,
    padding: 12,
    alignItems: "center",
    gap: 3,
    borderWidth: 1.5,
  },
  statValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 20,
  },
  statLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  usersHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 12,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
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
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.accent,
  },
  postAuthor: {
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.flame,
    textTransform: "capitalize",
  },
  postContent: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  postThumb: {
    width: "100%",
    height: 100,
    borderRadius: 12,
    backgroundColor: colors.cream,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(26,31,54,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
  },
  modalHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  modalInput: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
    backgroundColor: colors.cream,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: "center",
  },
  modalConfirmText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
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
    fontFamily: "PlusJakartaSans_700Bold",
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
    fontFamily: "PlusJakartaSans_700Bold",
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
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
  },
  emptySubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
  accessDenied: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  accessDeniedTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: colors.primary,
  },
  accessDeniedText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  activityTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  activityHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activityName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  activityCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusApproved: {
    backgroundColor: `${colors.success}22`,
  },
  statusDeclined: {
    backgroundColor: `${colors.danger}22`,
  },
  statusPillText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  requeueBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  requeueBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.primary,
  },
  btnDisabledInline: { opacity: 0.55 },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabBtnTextOn: {
    color: colors.surface,
  },
  manageUsersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  manageUsersBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
  },
  modOnlyTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
    marginBottom: 8,
  },
  usersBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  usersBackText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primary,
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
    gap: 4,
    flexWrap: "wrap",
    maxWidth: 220,
    justifyContent: "flex-end",
  },
  roleMini: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleMiniActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleMiniText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.primary,
  },
  roleMiniTextActive: {
    color: colors.surface,
  },
  banBtnActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  banBtnActiveText: {
    color: colors.surface,
  },
  deleteBtn: {
    backgroundColor: `${colors.danger}12`,
    borderColor: `${colors.danger}50`,
  },
  deleteBtnText: {
    color: colors.danger,
  },
  cmsCard: {
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cmsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cream,
  },
  cmsInputMultiline: {
    minHeight: 100,
  },
  cmsSlotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cmsSlotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  cmsSlotBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cmsSlotBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primary,
  },
  cmsSlotBtnTextOn: {
    color: colors.surface,
  },
});
