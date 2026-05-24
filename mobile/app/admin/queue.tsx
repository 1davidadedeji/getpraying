import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
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
import { useModerationBadge } from "@/context/moderationBadge";
import { apiUrl, authHeaders } from "@/lib/api";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

type StaffPostReport = {
  reporterUsername: string;
  reporterDisplayName: string | null;
  reason: string;
  createdAt: string;
};

type PendingPost = Post & {
  reports?: StaffPostReport[];
  flagReason?: string | null;
};

/** Readable caption for mod queue — hide image placeholder; clarify media-only posts. */
function moderationCaptionPreview(post: Post): { lines: string[]; muted: boolean } {
  const raw = String(post.content ?? "").trim();
  const hasMedia = !!(post.mediaUrl && String(post.mediaUrl).trim());
  if (raw === "(Image)" || (raw === "" && hasMedia)) {
    return {
      lines: ["No written text — see media above."],
      muted: true,
    };
  }
  if (!raw && !hasMedia) {
    return { lines: ["No text in this prayer."], muted: true };
  }
  return { lines: [raw], muted: false };
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const { uiScale } = useResponsiveLayout();
  const rad = Math.round(clamp(32 * uiScale, 26, 36));
  const pad = Math.round(clamp(12 * uiScale, 10, 14));
  const gap = Math.round(clamp(3 * uiScale, 2, 4));
  const fsVal = Math.round(clamp(20 * uiScale, 18, 24));
  const fsLbl = Math.round(clamp(11 * uiScale, 10, 12));
  const borderW = Math.max(1, Math.round(1.5 * uiScale));
  return (
    <View style={[styles.statBadge, { borderColor: `${color}40`, borderRadius: rad, padding: pad, gap, borderWidth: borderW }]}>
      <Text style={[styles.statValue, { color, fontSize: fsVal }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: fsLbl }]}>{label}</Text>
    </View>
  );
}

function PendingPostCard({
  post,
  onModerated,
}: {
  post: PendingPost;
  onModerated: () => void;
}) {
  const { uiScale, cardRadius } = useResponsiveLayout();
  const { mutate: approve, isPending: isApproving } = useApprovePost();
  const { mutate: decline, isPending: isDeclining } = useDeclinePost();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const modalPad = Math.round(clamp(24 * uiScale, 20, 28));
  const modalCardPad = Math.round(clamp(18 * uiScale, 16, 22));
  const modalRad = Math.round(clamp(24 * uiScale, 20, 28));
  const modalGap = Math.round(clamp(12 * uiScale, 10, 14));
  const fsModalTitle = Math.round(clamp(18 * uiScale, 16, 20));
  const fsModalHint = Math.round(clamp(13 * uiScale, 12, 14));
  const lhModalHint = Math.round(fsModalHint * 1.35);
  const modalInputMinH = Math.round(clamp(100 * uiScale, 88, 120));
  const modalInputRad = Math.round(clamp(16 * uiScale, 14, 18));
  const modalInputPad = Math.round(clamp(12 * uiScale, 10, 14));
  const fsModalInput = Math.round(clamp(15 * uiScale, 14, 16));
  const modalActGap = Math.round(clamp(10 * uiScale, 8, 12));
  const modalActMt = Math.round(clamp(4 * uiScale, 3, 5));
  const modalBtnPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const modalBtnRad = Math.round(clamp(14 * uiScale, 12, 16));
  const fsModalBtn = Math.round(clamp(14 * uiScale, 13, 16));
  const cardPad = Math.round(clamp(14 * uiScale, 12, 18));
  const cardRad = Math.round(clamp(cardRadius, 28, 40));
  const cardGap = Math.round(clamp(10 * uiScale, 8, 12));
  const cardMb = Math.round(clamp(12 * uiScale, 10, 14));
  const hdrGap = Math.round(clamp(8 * uiScale, 6, 10));
  const avSz = Math.round(clamp(34 * uiScale, 30, 38));
  const avFs = Math.round(clamp(14 * uiScale, 13, 16));
  const fsAuthor = Math.round(clamp(14 * uiScale, 13, 16));
  const catPadH = Math.round(clamp(7 * uiScale, 6, 9));
  const catPadV = Math.round(clamp(2 * uiScale, 2, 3));
  const catRad = Math.round(clamp(6 * uiScale, 5, 8));
  const fsCat = Math.round(clamp(10 * uiScale, 9, 11));
  const thumbH = Math.round(clamp(100 * uiScale, 88, 120));
  const thumbRad = Math.round(clamp(12 * uiScale, 10, 14));
  const thumbMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsPost = Math.round(clamp(14 * uiScale, 13, 16));
  const lhPost = Math.round(fsPost * 1.45);
  const actGap = Math.round(clamp(10 * uiScale, 8, 12));
  const btnPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const btnRad = Math.round(clamp(10 * uiScale, 8, 12));
  const btnIcn = Math.round(clamp(16 * uiScale, 14, 18));
  const fsBtn = Math.round(clamp(14 * uiScale, 13, 16));
  const pillPadH = Math.round(clamp(8 * uiScale, 6, 10));
  const pillPadV = Math.round(clamp(3 * uiScale, 2, 4));
  const pillRad = Math.round(clamp(8 * uiScale, 6, 10));
  const fsPill = Math.round(clamp(10 * uiScale, 9, 11));
  const btnRowGap = Math.round(clamp(6 * uiScale, 5, 8));
  const cardBorderW = Math.max(1, Math.round(uiScale));

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
  const caption = moderationCaptionPreview(post);
  const reports = post.reports ?? [];

  return (
    <View
      style={[
        styles.postCard,
        {
          padding: cardPad,
          borderRadius: cardRad,
          marginBottom: cardMb,
          gap: cardGap,
          borderWidth: cardBorderW,
        },
      ]}
    >
      <Modal visible={declineOpen} transparent animationType="fade">
        <Pressable
          style={[styles.modalBackdrop, { padding: modalPad }]}
          onPress={() => setDeclineOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                borderRadius: modalRad,
                padding: modalCardPad,
                gap: modalGap,
                borderWidth: cardBorderW,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { fontSize: fsModalTitle }]}>Decline post</Text>
            <Text style={[styles.modalHint, { fontSize: fsModalHint, lineHeight: lhModalHint }]}>
              The author will get an alert with this reason. Be clear and respectful.
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Reason for declining…"
              placeholderTextColor={colors.muted}
              style={[
                styles.modalInput,
                {
                  minHeight: modalInputMinH,
                  borderRadius: modalInputRad,
                  padding: modalInputPad,
                  fontSize: fsModalInput,
                  borderWidth: cardBorderW,
                },
              ]}
              multiline
              maxLength={500}
            />
            <View style={[styles.modalActions, { gap: modalActGap, marginTop: modalActMt }]}>
              <Pressable
                style={[
                  styles.modalCancel,
                  { paddingVertical: modalBtnPadV, borderRadius: modalBtnRad, borderWidth: cardBorderW },
                ]}
                onPress={() => {
                  setDeclineOpen(false);
                  setDeclineReason("");
                }}
              >
                <Text style={[styles.modalCancelText, { fontSize: fsModalBtn }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirm,
                  { paddingVertical: modalBtnPadV, borderRadius: modalBtnRad },
                  isDeclining && styles.btnDisabledInline,
                ]}
                onPress={submitDecline}
                disabled={isDeclining}
              >
                {isDeclining ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Text style={[styles.modalConfirmText, { fontSize: fsModalBtn }]}>Decline post</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.postHeader, { gap: hdrGap }]}>
        <View
          style={[
            styles.postAvatar,
            { width: avSz, height: avSz, borderRadius: Math.round(avSz / 2) },
          ]}
        >
          <Text style={[styles.postAvatarText, { fontSize: avFs }]}>
            {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <View style={styles.postAuthorBlock}>
          <Text style={[styles.postAuthor, { fontSize: fsAuthor }]}>{authorName}</Text>
          {!post.isAnonymous && post.authorUsername ? (
            <Text style={[styles.postAuthorHandle, { fontSize: fsPill }]}>@{post.authorUsername}</Text>
          ) : null}
        </View>
        {post.category && (
          <View
            style={[
              styles.postCategoryBadge,
              { borderRadius: catRad, paddingHorizontal: catPadH, paddingVertical: catPadV },
            ]}
          >
            <Text style={[styles.postCategoryText, { fontSize: fsCat }]}>{post.category}</Text>
          </View>
        )}
      </View>
      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={[styles.postThumb, { height: thumbH, borderRadius: thumbRad, marginBottom: thumbMb }]}
        compact
        thumbnail
      />
      <Text
        style={[
          styles.postContent,
          caption.muted && styles.postContentMuted,
          { fontSize: fsPost, lineHeight: lhPost },
        ]}
        numberOfLines={4}
      >
        {caption.lines[0]}
      </Text>
      <Pressable onPress={() => router.push(`/post/${post.id}` as never)} style={styles.openFullPost}>
        <Text style={[styles.openFullPostText, { fontSize: fsPill }]}>Open full post</Text>
      </Pressable>
      {reports.length > 0 ? (
        <View style={[styles.reportsSection, { borderRadius: btnRad, padding: catPadH, gap: btnRowGap }]}>
          <Text style={[styles.reportsSectionTitle, { fontSize: fsPill }]}>
            Reported by {reports.length === 1 ? "1 person" : `${reports.length} people`}
          </Text>
          {reports.map((report, idx) => {
            const reporterName = report.reporterDisplayName ?? report.reporterUsername;
            return (
              <View key={`${report.reporterUsername}-${idx}`} style={styles.reportRow}>
                <Text style={[styles.reportReporter, { fontSize: fsPill }]}>
                  {reporterName}
                  <Text style={styles.reportReporterHandle}> @{report.reporterUsername}</Text>
                </Text>
                <Text style={[styles.reportReason, { fontSize: fsPill, lineHeight: Math.round(fsPill * 1.4) }]}>
                  {report.reason}
                </Text>
              </View>
            );
          })}
        </View>
      ) : post.flagReason ? (
        <View style={[styles.flagReasonBanner, { borderRadius: btnRad, padding: catPadH }]}>
          <Ionicons name="flag" size={btnIcn} color={colors.danger} />
          <Text style={[styles.flagReasonText, { fontSize: fsPill, lineHeight: Math.round(fsPill * 1.4) }]}>
            Report reason: {post.flagReason}
          </Text>
        </View>
      ) : null}
      <View style={[styles.postActions, { gap: actGap }]}>
        <Pressable
          style={[
            styles.approveBtn,
            { paddingVertical: btnPadV, borderRadius: btnRad, gap: btnRowGap },
          ]}
          onPress={handleApprove}
          disabled={isApproving || isDeclining}
        >
          {isApproving ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <>
              <Feather name="check" size={btnIcn} color={colors.surface} />
              <Text style={[styles.approveBtnText, { fontSize: fsBtn }]}>Approve</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.declineBtn,
            { paddingVertical: btnPadV, borderRadius: btnRad, gap: btnRowGap, borderWidth: Math.max(1, Math.round(1.5 * uiScale)) },
          ]}
          onPress={() => setDeclineOpen(true)}
          disabled={isApproving || isDeclining}
        >
          {isDeclining ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <>
              <Feather name="x" size={btnIcn} color={colors.danger} />
              <Text style={[styles.declineBtnText, { fontSize: fsBtn }]}>Decline</Text>
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
  const { uiScale } = useResponsiveLayout();
  const actPad = Math.round(clamp(14 * uiScale, 12, 18));
  const actRad = Math.round(clamp(24 * uiScale, 20, 28));
  const actGap = Math.round(clamp(8 * uiScale, 6, 10));
  const actMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsActTitle = Math.round(clamp(16 * uiScale, 15, 19));
  const fsActHint = Math.round(clamp(12 * uiScale, 11, 14));
  const actHintMb = Math.round(clamp(4 * uiScale, 3, 5));
  const actRowPy = Math.round(clamp(6 * uiScale, 5, 8));
  const fsActName = Math.round(clamp(14 * uiScale, 13, 16));
  const fsActCount = Math.round(clamp(13 * uiScale, 12, 15));
  const actBorderW = Math.max(1, Math.round(uiScale));

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
    <View
      style={[
        styles.activityCard,
        {
          padding: actPad,
          borderRadius: actRad,
          marginBottom: actMb,
          gap: actGap,
          borderWidth: actBorderW,
        },
      ]}
    >
      <Text style={[styles.activityTitle, { fontSize: fsActTitle }]}>Moderator activity</Text>
      <Text style={[styles.activityHint, { fontSize: fsActHint, marginBottom: actHintMb }]}>
        Recent approve/decline actions recorded on posts.
      </Text>
      {rows.map((r) => (
        <View key={r.moderatorId} style={[styles.activityRow, { paddingVertical: actRowPy }]}>
          <Text style={[styles.activityName, { fontSize: fsActName }]}>
            {r.displayName ?? r.username ?? `User #${r.moderatorId}`}
          </Text>
          <Text style={[styles.activityCount, { fontSize: fsActCount }]}>{r.actions} actions</Text>
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
  const { uiScale, cardRadius } = useResponsiveLayout();
  const cardPad = Math.round(clamp(14 * uiScale, 12, 18));
  const cardRad = Math.round(clamp(cardRadius, 28, 40));
  const cardGap = Math.round(clamp(10 * uiScale, 8, 12));
  const cardMb = Math.round(clamp(12 * uiScale, 10, 14));
  const cardBorderW = Math.max(1, Math.round(uiScale));
  const hdrGap = Math.round(clamp(8 * uiScale, 6, 10));
  const avSz = Math.round(clamp(34 * uiScale, 30, 38));
  const avFs = Math.round(clamp(14 * uiScale, 13, 16));
  const fsAuthor = Math.round(clamp(14 * uiScale, 13, 16));
  const thumbH = Math.round(clamp(100 * uiScale, 88, 120));
  const thumbRad = Math.round(clamp(12 * uiScale, 10, 14));
  const thumbMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsPost = Math.round(clamp(14 * uiScale, 13, 16));
  const lhPost = Math.round(fsPost * 1.45);
  const pillPadH = Math.round(clamp(8 * uiScale, 6, 10));
  const pillPadV = Math.round(clamp(3 * uiScale, 2, 4));
  const pillRad = Math.round(clamp(8 * uiScale, 6, 10));
  const fsPill = Math.round(clamp(10 * uiScale, 9, 11));
  const requeueMt = Math.round(clamp(4 * uiScale, 3, 5));
  const requeuePadV = Math.round(clamp(10 * uiScale, 8, 12));
  const requeueRad = Math.round(clamp(10 * uiScale, 8, 12));
  const fsRequeue = Math.round(clamp(13 * uiScale, 12, 15));
  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";
  const captionReviewed = moderationCaptionPreview(post);

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
    <View
      style={[
        styles.postCard,
        {
          padding: cardPad,
          borderRadius: cardRad,
          marginBottom: cardMb,
          gap: cardGap,
          borderWidth: cardBorderW,
        },
      ]}
    >
      <View style={[styles.postHeader, { gap: hdrGap }]}>
        <View
          style={[
            styles.postAvatar,
            { width: avSz, height: avSz, borderRadius: Math.round(avSz / 2) },
          ]}
        >
          <Text style={[styles.postAvatarText, { fontSize: avFs }]}>
            {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.postAuthor, { fontSize: fsAuthor }]}>{authorName}</Text>
        <View
          style={[
            styles.statusPill,
            { borderRadius: pillRad, paddingHorizontal: pillPadH, paddingVertical: pillPadV },
            post.status === "approved" ? styles.statusApproved : styles.statusDeclined,
          ]}
        >
          <Text style={[styles.statusPillText, { fontSize: fsPill }]}>{post.status}</Text>
        </View>
      </View>
      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={[styles.postThumb, { height: thumbH, borderRadius: thumbRad, marginBottom: thumbMb }]}
        compact
        thumbnail
      />
      <Text
        style={[
          styles.postContent,
          captionReviewed.muted && styles.postContentMuted,
          { fontSize: fsPost, lineHeight: lhPost },
        ]}
        numberOfLines={5}
      >
        {captionReviewed.lines[0]}
      </Text>
      <Pressable onPress={() => router.push(`/post/${post.id}` as never)} style={styles.openFullPost}>
        <Text style={[styles.openFullPostText, { fontSize: fsPill }]}>Open full post</Text>
      </Pressable>
      {post.status === "approved" ? (
        <Pressable
          style={[
            styles.requeueBtn,
            {
              marginTop: requeueMt,
              paddingVertical: requeuePadV,
              borderRadius: requeueRad,
              borderWidth: cardBorderW,
            },
            loading && styles.btnDisabledInline,
          ]}
          onPress={requeue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.requeueBtnText, { fontSize: fsRequeue }]}>
              Return to moderation queue
            </Text>
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
  const { refresh: refreshModBadge } = useModerationBadge();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator" || isAdmin;
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const { gutter, uiScale } = useResponsiveLayout();
  const listPadH = gutter;
  const listPadTop = Math.round(clamp(8 * uiScale, 6, 12));
  const headerTopWeb = Math.round(clamp(20 * uiScale, 16, 24));
  const headerTopNative = Math.round(clamp(8 * uiScale, 6, 12));
  const statsGap = Math.round(clamp(10 * uiScale, 8, 12));
  const statsMb = Math.round(clamp(16 * uiScale, 14, 20));
  const statsMt = Math.round(clamp(8 * uiScale, 6, 10));
  const tabMb = Math.round(clamp(12 * uiScale, 10, 14));
  const tabBtnPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const tabBtnRad = Math.round(clamp(14 * uiScale, 12, 16));
  const tabBtnFs = Math.round(clamp(14 * uiScale, 13, 16));
  const tabBorderW = Math.max(1, Math.round(uiScale));
  const sectionFs = Math.round(clamp(13 * uiScale, 12, 14));
  const sectionMb = Math.round(clamp(12 * uiScale, 10, 14));
  const sectionLs = clamp(0.8 * uiScale, 0.5, 1.1);
  const modTitleFs = Math.round(clamp(18 * uiScale, 16, 20));
  const modTitleMb = Math.round(clamp(8 * uiScale, 6, 10));
  const emptyIcon = Math.round(clamp(48 * uiScale, 40, 56));
  const emptyPt = Math.round(clamp(60 * uiScale, 48, 72));
  const emptyGap = Math.round(clamp(10 * uiScale, 8, 12));
  const emptyTitleFs = Math.round(clamp(18 * uiScale, 16, 20));
  const emptySubFs = Math.round(clamp(14 * uiScale, 13, 16));
  const loaderMt = Math.round(clamp(40 * uiScale, 32, 48));
  const listBottomExtra = Math.round(clamp(40 * uiScale, 32, 48));
  const accessIcon = Math.round(clamp(40 * uiScale, 34, 48));
  const accessPad = Math.round(clamp(32 * uiScale, 24, 40));
  const accessGap = Math.round(clamp(12 * uiScale, 10, 14));
  const accessTitleFs = Math.round(clamp(20 * uiScale, 18, 22));
  const accessTextFs = Math.round(clamp(14 * uiScale, 13, 16));
  const accessLh = Math.round(accessTextFs * 1.45);

  useFocusEffect(
    useCallback(() => {
      void refreshModBadge();
    }, [refreshModBadge]),
  );

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
      <View style={[styles.accessDenied, { padding: accessPad, gap: accessGap }]}>
        <Ionicons name="lock-closed-outline" size={accessIcon} color={colors.muted} />
        <Text style={[styles.accessDeniedTitle, { fontSize: accessTitleFs }]}>Restricted</Text>
        <Text style={[styles.accessDeniedText, { fontSize: accessTextFs, lineHeight: accessLh }]}>
          Moderators and admins can open this screen from the feed or profile.
        </Text>
      </View>
    );
  }

  const stats = statsData as any;
  const pendingPosts: PendingPost[] = (pendingQ.data as any)?.posts ?? [];
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
              void refreshModBadge();
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
        <View style={{ paddingTop: Platform.OS === "web" ? headerTopWeb : headerTopNative }}>
          {isAdmin ? (
            <>
              <ModActivityCard token={token} />
              {stats && (
                <View style={[styles.statsRow, { gap: statsGap, marginBottom: statsMb, marginTop: statsMt }]}>
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
              <View style={[styles.tabRow, { gap: statsGap, marginBottom: tabMb }]}>
                <Pressable
                  style={[
                    styles.tabBtn,
                    {
                      paddingVertical: tabBtnPadV,
                      borderRadius: tabBtnRad,
                      borderWidth: tabBorderW,
                    },
                    tab === "pending" && styles.tabBtnOn,
                  ]}
                  onPress={() => setTab("pending")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      { fontSize: tabBtnFs },
                      tab === "pending" && styles.tabBtnTextOn,
                    ]}
                  >
                    Pending
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tabBtn,
                    {
                      paddingVertical: tabBtnPadV,
                      borderRadius: tabBtnRad,
                      borderWidth: tabBorderW,
                    },
                    tab === "reviewed" && styles.tabBtnOn,
                  ]}
                  onPress={() => setTab("reviewed")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      { fontSize: tabBtnFs },
                      tab === "reviewed" && styles.tabBtnTextOn,
                    ]}
                  >
                    Reviewed
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[styles.modOnlyTitle, { fontSize: modTitleFs, marginBottom: modTitleMb }]}>
              Pending review
            </Text>
          )}
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: sectionFs, marginBottom: sectionMb, letterSpacing: sectionLs },
            ]}
          >
            {tab === "pending" ? "Queue" : "Recently moderated"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.accent} style={[styles.loader, { marginTop: loaderMt }]} />
        ) : (
          <View style={[styles.emptyState, { paddingTop: emptyPt, gap: emptyGap }]}>
            <Ionicons name="checkmark-circle-outline" size={emptyIcon} color={colors.muted} />
            <Text style={[styles.emptyTitle, { fontSize: emptyTitleFs }]}>
              {tab === "pending" ? "All clear" : "Nothing here yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { fontSize: emptySubFs }]}>
              {tab === "pending"
                ? "No pending prayer posts"
                : "Approved and declined posts show here for admins."}
            </Text>
          </View>
        )
      }
      contentContainerStyle={[
        styles.list,
        {
          paddingHorizontal: listPadH,
          paddingTop: listPadTop,
          paddingBottom: botPad + listBottomExtra,
        },
      ]}
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
  postAuthorBlock: {
    flex: 1,
    gap: 1,
  },
  postAuthor: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  postAuthorHandle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
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
  postContentMuted: {
    color: colors.muted,
    fontStyle: "italic",
  },
  openFullPost: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 4,
  },
  openFullPostText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  flagReasonBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${colors.danger}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.danger}40`,
  },
  flagReasonText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.danger,
  },
  reportsSection: {
    backgroundColor: `${colors.danger}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.danger}40`,
  },
  reportsSectionTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.danger,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reportRow: {
    gap: 2,
  },
  reportReporter: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.text,
  },
  reportReporterHandle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  reportReason: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
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
