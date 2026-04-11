import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  useGetPendingPosts,
  useSetDailyWordOverride,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { formatLocalYMD } from "@/lib/date";
import { getApiErrorMessage } from "@/lib/apiErrors";

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
    showAppAlert({
      title: "Decline prayer",
      message: "This post will be removed from the moderation queue.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            decline({ postId: post.id }, { onSuccess: onModerated });
          },
        },
      ],
    });
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
          <DailyWordAdminCard />
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
});
