import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  getGetDailyWordQueryKey,
  useApprovePost,
  useClearDailyWordOverride,
  useDeclinePost,
  useGetAdminStats,
  useGetDailyWord,
  getGetAdminStatsQueryKey,
  getGetModeratedPostsQueryKey,
  useGetModeratedPosts,
  useGetPendingPosts,
  useSetDailyWordOverride,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { formatLocalYMD } from "@/lib/date";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { getApiBaseUrl } from "@/lib/apiBase";
import { useAuth } from "@/context/auth";

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

function DailyWordAdminCard() {
  const [dateStr, setDateStr] = useState(() => formatLocalYMD(new Date()));
  const [quoteText, setQuoteText] = useState("");
  const [reference, setReference] = useState("");
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());

  const trimmedDate = dateStr.trim();
  const { data: word, refetch: refetchWord } = useGetDailyWord(
    { date: trimmedDate },
    {
      query: {
        queryKey: getGetDailyWordQueryKey({ date: trimmedDate }),
        enabled: dateOk,
        retry: 1,
      },
    },
  );

  useEffect(() => {
    if (!word) return;
    setQuoteText(word.quoteText);
    setReference(word.reference);
  }, [word?.date, word?.quoteText, word?.reference]);

  const setOverride = useSetDailyWordOverride();
  const clearOverride = useClearDailyWordOverride();

  const onSave = () => {
    const d = dateStr.trim();
    const qt = quoteText.trim();
    const ref = reference.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !qt || !ref) {
      showAppAlert({
        title: "Check fields",
        message: "Use date YYYY-MM-DD and fill in both quote and reference.",
      });
      return;
    }
    setOverride.mutate(
      { data: { effectiveDate: d, quoteText: qt, reference: ref } },
      {
        onSuccess: () => {
          showAppAlert({
            title: "Saved",
            message: "Daily Word for that date has been updated.",
          });
          refetchWord();
        },
        onError: (e: unknown) =>
          showAppAlert({ title: "Save failed", message: getApiErrorMessage(e, "Try again") }),
      },
    );
  };

  const onClear = () => {
    const d = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      showAppAlert({ title: "Invalid date", message: "Use YYYY-MM-DD." });
      return;
    }
    clearOverride.mutate(
      { params: { date: d } },
      {
        onSuccess: () => {
          showAppAlert({
            title: "Cleared",
            message: "That date will use the automatic daily rotation again.",
          });
          refetchWord();
        },
        onError: (e: unknown) =>
          showAppAlert({ title: "Clear failed", message: getApiErrorMessage(e, "Try again") }),
      },
    );
  };

  return (
    <View style={dwStyles.card}>
      <Text style={dwStyles.cardTitle}>{"Today's Word (override)"}</Text>
      <Text style={dwStyles.hint}>
        Set a custom verse for a calendar date, or clear to use the automatic rotation (
        {word?.source === "override" ? "this date has an override" : "this date uses defaults"}).
      </Text>
      <Text style={dwStyles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="2026-04-07"
        placeholderTextColor={colors.muted}
        style={dwStyles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={dwStyles.label}>Quote</Text>
      <TextInput
        value={quoteText}
        onChangeText={setQuoteText}
        placeholder="Verse text"
        placeholderTextColor={colors.muted}
        style={[dwStyles.input, dwStyles.inputMultiline]}
        multiline
      />
      <Text style={dwStyles.label}>Reference</Text>
      <TextInput
        value={reference}
        onChangeText={setReference}
        placeholder="— Psalm 23:1"
        placeholderTextColor={colors.muted}
        style={dwStyles.input}
        autoCapitalize="none"
      />
      <View style={dwStyles.row}>
        <Pressable
          style={[dwStyles.btn, dwStyles.btnPrimary, setOverride.isPending && dwStyles.btnDisabled]}
          onPress={onSave}
          disabled={setOverride.isPending}
        >
          {setOverride.isPending ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={dwStyles.btnPrimaryText}>Save override</Text>
          )}
        </Pressable>
        <Pressable
          style={[dwStyles.btn, dwStyles.btnGhost, clearOverride.isPending && dwStyles.btnDisabled]}
          onPress={onClear}
          disabled={clearOverride.isPending}
        >
          {clearOverride.isPending ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={dwStyles.btnGhostText}>Clear</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const dwStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: colors.primary,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
    lineHeight: 18,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: colors.success,
  },
  btnPrimaryText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
  },
  btnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  btnGhostText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.danger,
  },
  btnDisabled: { opacity: 0.6 },
});

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
        const res = await fetch(`${getApiBaseUrl()}/api/admin/moderators/activity`, {
          headers: { Authorization: `Bearer ${token}` },
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
      const res = await fetch(`${getApiBaseUrl()}/api/admin/posts/${post.id}/requeue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

function UsersAdminPanel({
  token,
  onBack,
  botPad,
}: {
  token: string | null;
  onBack: () => void;
  botPad: number;
}) {
  const [users, setUsers] = useState<
    { id: number; username: string; displayName: string | null; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/users?limit=80`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      showAppAlert({ title: "Could not load users", message: "Check your connection." });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
            const res = await fetch(`${getApiBaseUrl()}/api/admin/users/${userId}/role`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ role }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              showAppAlert({ title: "Update failed", message: data?.error ?? "Try again." });
              return;
            }
            await load();
          },
        },
      ],
    });
  };

  return (
    <View style={[styles.list, { flex: 1, paddingTop: Platform.OS === "web" ? 20 : 8 }]}>
      <Pressable onPress={onBack} style={styles.usersBackRow}>
        <Feather name="arrow-left" size={20} color={colors.primary} />
        <Text style={styles.usersBackText}>Back to moderation</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>Users & roles</Text>
      <Text style={styles.usersHint}>
        Admins can promote to moderator or admin, or demote with User (regular member).
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          scrollEnabled={false}
          renderItem={({ item: u }) => (
            <View style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.displayName ?? u.username}</Text>
                <Text style={styles.userMeta}>@{u.username} · {u.role}</Text>
              </View>
              <View style={styles.roleBtns}>
                <Pressable
                  style={styles.roleMini}
                  onPress={() => changeRole(u.id, u.username, "user")}
                >
                  <Text style={styles.roleMiniText}>User</Text>
                </Pressable>
                <Pressable
                  style={styles.roleMini}
                  onPress={() => changeRole(u.id, u.username, "moderator")}
                >
                  <Text style={styles.roleMiniText}>Mod</Text>
                </Pressable>
                <Pressable
                  style={styles.roleMini}
                  onPress={() => changeRole(u.id, u.username, "admin")}
                >
                  <Text style={styles.roleMiniText}>Admin</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptySubtitle}>No users returned.</Text>
          }
        />
      )}
      <View style={{ height: botPad + 24 }} />
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator" || isAdmin;
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [usersOpen, setUsersOpen] = useState(false);

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

  if (isAdmin && usersOpen) {
    return (
      <UsersAdminPanel token={token} onBack={() => setUsersOpen(false)} botPad={botPad} />
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
          <PendingPostCard post={item} onModerated={pendingQ.refetch} />
        ) : (
          <ReviewedPostCard post={item} token={token} onChanged={() => void moderatedQ.refetch()} />
        )
      }
      ListHeaderComponent={
        <View style={{ paddingTop: Platform.OS === "web" ? 20 : 8 }}>
          {isAdmin ? (
            <>
              <DailyWordAdminCard />
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
              <Pressable style={styles.manageUsersBtn} onPress={() => setUsersOpen(true)}>
                <Feather name="users" size={18} color={colors.surface} />
                <Text style={styles.manageUsersBtnText}>Manage users & roles</Text>
              </Pressable>
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
    flexWrap: "wrap",
    maxWidth: 140,
    justifyContent: "flex-end",
  },
  roleMini: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleMiniText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.primary,
  },
});
