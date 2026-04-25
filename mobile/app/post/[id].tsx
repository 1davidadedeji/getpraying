import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetMeQueryKey,
  getGetModeratedPostsQueryKey,
  getGetPendingPostsQueryKey,
  getGetPostQueryKey,
  getGetPostsQueryKey,
  getGetSavedPrayersQueryKey,
  getGetTrendingPostsQueryKey,
  getGetUserPostsQueryKey,
  getGetUserProfileQueryKey,
  useGetPost,
  usePrayForPost,
  useSavePost,
  useUnsavePost,
} from "@workspace/api-client-react";
import type { Post, SavePostStateResponse } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { PostMediaBlock } from "@/components/PostMedia";
import { showAppAlert } from "@/components/AppAlert";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { timeAgo } from "@/lib/timeAgo";
import { apiUrl, authHeaders } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";

type CommentRow = {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
};

export default function PostDetailScreen() {
  const { id, focusComment } = useLocalSearchParams<{ id: string; focusComment?: string }>();
  const postId = Number(id);
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [staffDeleteOpen, setStaffDeleteOpen] = useState(false);
  const [staffDeleteReason, setStaffDeleteReason] = useState("");
  const queryClient = useQueryClient();
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  const replyFirst = useMemo(() => {
    const v = Array.isArray(focusComment) ? focusComment[0] : focusComment;
    return v === "1" || v === "true";
  }, [focusComment]);
  const [threadOpen, setThreadOpen] = useState(() => !replyFirst);

  const { data, isLoading } = useGetPost(Number(id));

  useEffect(() => {
    if (data) setLocalPost(data as any);
  }, [data]);

  const post = localPost ?? (data as any);

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { gutter, uiScale, cardRadius, windowWidth } = useResponsiveLayout();
  const engageIcn = Math.round(clamp(24 * uiScale, 20, 28));
  const shareIcn = Math.max(16, engageIcn - 2);
  const flagIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const moreIcn = Math.round(clamp(20 * uiScale, 18, 22));
  const listPad = gutter;
  const listMaxW = Math.min(680, windowWidth);
  const authorGap = Math.round(clamp(10 * uiScale, 8, 12));
  const authorRowMb = Math.round(clamp(20 * uiScale, 16, 24));
  const avatarSz = Math.round(clamp(44 * uiScale, 40, 52));
  const avatarFs = Math.round(clamp(18 * uiScale, 16, 20));
  const fsAuthorName = Math.round(clamp(15 * uiScale, 14, 17));
  const fsTime = Math.round(clamp(12 * uiScale, 11, 13));
  const catPadH = Math.round(clamp(10 * uiScale, 8, 12));
  const catPadV = Math.round(clamp(4 * uiScale, 3, 5));
  const catRad = Math.round(clamp(8 * uiScale, 6, 10));
  const fsCat = Math.round(clamp(12 * uiScale, 11, 13));
  const rightGap = Math.round(clamp(8 * uiScale, 6, 10));
  const postImgMb = Math.round(clamp(20 * uiScale, 16, 24));
  const fsPrayer = Math.round(clamp(18 * uiScale, 16, 20));
  const lhPrayer = Math.round(fsPrayer * 1.65);
  const prayerMb = Math.round(clamp(24 * uiScale, 20, 28));
  const dividerMb = Math.round(clamp(16 * uiScale, 14, 18));
  const reactMb = Math.round(clamp(20 * uiScale, 16, 24));
  const flameIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const prayCountGap = Math.round(clamp(6 * uiScale, 5, 8));
  const fsPrayCount = Math.round(clamp(14 * uiScale, 13, 16));
  const fsCommentsTitle = Math.round(clamp(18 * uiScale, 16, 21));
  const commentsTitleMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsReplyHint = Math.round(clamp(14 * uiScale, 13, 16));
  const replyHintMb = Math.round(clamp(12 * uiScale, 10, 14));
  const commentsLoadPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const commentsLoadMb = Math.round(clamp(8 * uiScale, 6, 10));
  const stickyGap = Math.round(clamp(10 * uiScale, 8, 12));
  const stickyPadH = Math.round(clamp(16 * uiScale, 14, 18));
  const stickyPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const inputFs = Math.round(clamp(15 * uiScale, 14, 16));
  const inputMinH = Math.round(clamp(40 * uiScale, 36, 46));
  const inputMaxH = Math.round(clamp(120 * uiScale, 100, 140));
  const inputPadV = Math.round(Platform.OS === "ios" ? clamp(10 * uiScale, 8, 12) : clamp(8 * uiScale, 6, 10));
  const inputPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const inputRad = Math.round(clamp(20 * uiScale, 16, 24));
  const sendPadH = Math.round(clamp(18 * uiScale, 16, 22));
  const sendPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const sendFs = Math.round(clamp(14 * uiScale, 13, 16));
  const emptyFs = Math.round(clamp(15 * uiScale, 14, 16));
  const emptyMb = Math.round(clamp(16 * uiScale, 14, 18));
  const commentCardPad = Math.round(clamp(16 * uiScale, 14, 18));
  const commentCardRad = cardRadius;
  const commentCardMb = Math.round(clamp(12 * uiScale, 10, 14));
  const commentCardGap = Math.round(clamp(12 * uiScale, 10, 14));
  const commentAv = Math.round(clamp(40 * uiScale, 36, 46));
  const commentAvFs = Math.round(clamp(16 * uiScale, 15, 18));
  const fsComAuthor = Math.round(clamp(14 * uiScale, 13, 16));
  const fsComTime = Math.round(clamp(12 * uiScale, 11, 13));
  const metaRowMb = Math.round(clamp(4 * uiScale, 3, 5));
  const metaGap = Math.round(clamp(8 * uiScale, 6, 10));
  const fsComContent = Math.round(clamp(15 * uiScale, 14, 16));
  const lhComContent = Math.round(fsComContent * 1.45);
  const actionBarPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const actionBarPadT = Math.round(clamp(12 * uiScale, 10, 14));
  const actionBarBot = Math.round(clamp(12 * uiScale, 10, 14));
  const actionGap = Math.round(clamp(8 * uiScale, 6, 10));
  const prayBtnPadV = Math.round(clamp(14 * uiScale, 12, 16));
  const prayBtnGap = Math.round(clamp(8 * uiScale, 6, 10));
  const prayBtnRad = Math.round(clamp(32 * uiScale, 28, 36));
  const fsPrayBtn = Math.round(clamp(15 * uiScale, 14, 16));
  const iconBtnSz = Math.round(clamp(48 * uiScale, 44, 54));
  const iconBtnRad = iconBtnSz / 2;
  const kbOffset = Math.round(insets.top + clamp(52 * uiScale, 44, 60));
  const modalPad = Math.round(clamp(24 * uiScale, 20, 28));
  const modalCardPad = Math.round(clamp(20 * uiScale, 18, 24));
  const modalRad = Math.round(clamp(24 * uiScale, 20, 28));
  const fsModalTitle = Math.round(clamp(18 * uiScale, 16, 20));
  const modalTitleMb = Math.round(clamp(6 * uiScale, 4, 8));
  const fsModalHelp = Math.round(clamp(13 * uiScale, 12, 14));
  const modalHelpMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsModalInput = Math.round(clamp(15 * uiScale, 14, 16));
  const modalInputMinH = Math.round(clamp(100 * uiScale, 88, 120));
  const modalInputPad = Math.round(clamp(12 * uiScale, 10, 14));
  const modalInputRad = Math.round(clamp(14 * uiScale, 12, 16));
  const modalActGap = Math.round(clamp(12 * uiScale, 10, 14));
  const modalActMt = Math.round(clamp(16 * uiScale, 14, 18));
  const modalCancelPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const modalCancelPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const fsModalCancel = Math.round(clamp(15 * uiScale, 14, 16));
  const modalDelPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const modalDelPadH = Math.round(clamp(20 * uiScale, 18, 24));
  const fsModalDel = Math.round(clamp(15 * uiScale, 14, 16));

  useEffect(() => {
    setThreadOpen(!replyFirst);
  }, [postId, replyFirst]);

  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(apiUrl(`/posts/${post.id}/comments`), {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setComments([]);
        return;
      }
      const dataJson = await res.json();
      setComments((dataJson.comments ?? []) as CommentRow[]);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [post?.id, token]);

  useEffect(() => {
    if (post?.id) void loadComments();
  }, [post?.id, loadComments]);

  useEffect(() => {
    if (!replyFirst || !post) return;
    const t = setTimeout(() => commentInputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [replyFirst, post?.id]);

  // Scroll list to end when keyboard appears so the comment input stays visible
  useEffect(() => {
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  const isOwner =
    !!user && !!post && !post.isAnonymous &&
    (user.id === (post as any).authorId || user.username === post.authorUsername);
  const isAdmin = user?.role === "admin" || user?.role === "moderator";

  const runDelete = async (opts?: { reason?: string }) => {
    if (!post) return;
    try {
      const body =
        opts?.reason && opts.reason.length >= 3
          ? JSON.stringify({ reason: opts.reason })
          : undefined;
      const res = await fetch(apiUrl(`/posts/${post.id}`), {
        method: "DELETE",
        headers: authHeaders(
          token,
          body ? { "Content-Type": "application/json" } : undefined,
        ),
        body,
      });
      if (res.ok) {
        queryClient.removeQueries({ queryKey: getGetPostQueryKey(post.id) });
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTrendingPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
        const authorUsername =
          typeof post.authorUsername === "string" && post.authorUsername.length > 0
            ? post.authorUsername
            : null;
        if (authorUsername) {
          queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(authorUsername) });
        }
        if (isAdmin) {
          queryClient.invalidateQueries({ queryKey: getGetPendingPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetModeratedPostsQueryKey() });
        }
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          /* noop */
        }
        setStaffDeleteOpen(false);
        setStaffDeleteReason("");
        router.back();
      } else {
        const err = await res.json().catch(() => ({}));
        showAppAlert({ title: "Could not delete", message: (err as any).error ?? "Please try again." });
      }
    } catch {
      showAppAlert({ title: "Could not delete", message: "Check your connection." });
    }
  };

  const handleDeletePost = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isAdmin && !isOwner) {
      setStaffDeleteReason("");
      setStaffDeleteOpen(true);
      return;
    }
    showAppAlert({
      title: "Delete this prayer?",
      message: "This will permanently remove it.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void runDelete(),
        },
      ],
    });
  };

  const handlePray = () => {
    if (!post) return;
    Animated.sequence([
      Animated.spring(flameScale, { toValue: 1.5, useNativeDriver: true }),
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pray(
      { postId: post.id },
      {
        onSuccess: (res) => {
          setLocalPost((p) =>
            p ? { ...p, hasPrayed: res.hasPrayed, prayCount: res.prayCount } : p,
          );
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          if (post.authorUsername) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProfileQueryKey(post.authorUsername),
            });
          }
        },
      },
    );
  };

  const handleSave = () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const invalidateSaved = () => {
      queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };
    if (post.isSaved) {
      unsave(
        { postId: post.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((p) => (p ? { ...p, isSaved: res.isSaved, saveCount: res.saveCount } : p));
            invalidateSaved();
          },
        },
      );
    } else {
      save(
        { postId: post.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((p) => (p ? { ...p, isSaved: res.isSaved, saveCount: res.saveCount } : p));
            invalidateSaved();
          },
        },
      );
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const authorName = post.isAnonymous
      ? "Anonymous"
      : post.authorDisplayName ?? post.authorUsername ?? "Someone";
    const message =
      `"${post.content.slice(0, 200)}${post.content.length > 200 ? "\u2026" : ""}"\n\n` +
      `\u2014 shared by ${authorName} on GetPraying\n` +
      `${post.prayCount} ${post.prayCount === 1 ? "person" : "people"} praying`;

    try {
      Haptics.selectionAsync();
      await Share.share(
        Platform.OS === "ios"
          ? { message, url: "https://getpraying.app" }
          : { message },
        { dialogTitle: "Share this prayer" },
      );
    } catch {
      // silently ignore user cancellation
    }
  };

  const handleReportFlag = () => {
    if (!post) return;
    Haptics.selectionAsync();
    showAppAlert({
      title: "Report this prayer?",
      message: "Our team will review this content.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/posts/${post.id}/flag`), {
                method: "POST",
                headers: authHeaders(token, { "Content-Type": "application/json" }),
                body: JSON.stringify({ reason: "inappropriate" }),
              });
              if (res.ok) {
                showAppAlert({ title: "Report submitted", message: "Thank you for helping keep the community safe." });
              } else {
                const err = await res.json().catch(() => ({}));
                showAppAlert({
                  title: "Could not submit report",
                  message: typeof (err as any).error === "string" ? (err as any).error : "Please try again later.",
                });
              }
            } catch {
              showAppAlert({ title: "Could not submit report", message: "Check your connection and try again." });
            }
          },
        },
      ],
    });
  };

  const submitComment = async () => {
    if (!post || !commentDraft.trim()) return;
    if (!token) {
      showAppAlert({ title: "Sign in required", message: "Please sign in to leave a comment." });
      return;
    }
    setCommentSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/posts/${post.id}/comments`), {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ content: commentDraft.trim() }),
      });
      if (res.status === 401) {
        showAppAlert({ title: "Sign in required", message: "Please sign in to leave a comment." });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showAppAlert({
          title: "Comment failed",
          message: typeof (err as any).error === "string" ? (err as any).error : "Please try again.",
        });
        return;
      }
      const dataJson = await res.json();
      const created = dataJson.comment as CommentRow | undefined;
      if (created) setComments((prev) => [...prev, created]);
      setThreadOpen(true);
      setCommentDraft("");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      if (post.authorUsername) {
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(post.authorUsername) });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showAppAlert({ title: "Comment failed", message: "Check your connection and try again." });
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (Number.isNaN(postId)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyComments}>Invalid prayer link</Text>
      </View>
    );
  }

  if (isLoading || !post) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  const listHeader = (
    <>
      <View style={[styles.authorRow, { gap: authorGap, marginBottom: authorRowMb }]}>
        <Pressable
          onPress={() => {
            if (!post.isAnonymous && post.authorUsername) {
                router.replace(`/user/${post.authorUsername}` as never);
            }
          }}
          disabled={post.isAnonymous || !post.authorUsername}
          style={[styles.authorPressable, { gap: authorGap }]}
        >
          {!post.isAnonymous && post.authorAvatarUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(post.authorAvatarUrl)! }}
              style={[styles.avatarImg, { width: avatarSz, height: avatarSz, borderRadius: avatarSz / 2 }]}
            />
          ) : (
            <View style={[styles.avatar, { width: avatarSz, height: avatarSz, borderRadius: avatarSz / 2 }]}>
              <Text style={[styles.avatarText, { fontSize: avatarFs }]}>
                {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.authorName, { fontSize: fsAuthorName }]}>{authorName}</Text>
            <Text style={[styles.time, { fontSize: fsTime }]}>{timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        <View style={[styles.authorRowRight, { gap: rightGap }]}>
          {post.category && (
            <View style={[styles.categoryBadge, { paddingHorizontal: catPadH, paddingVertical: catPadV, borderRadius: catRad }]}>
              <Text style={[styles.categoryText, { fontSize: fsCat }]}>
                {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
              </Text>
            </View>
          )}
          {(isOwner || isAdmin) && (
            <Pressable
              onPress={handleDeletePost}
              hitSlop={8}
              style={styles.flagBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete or manage this prayer"
            >
              <Feather name="more-horizontal" size={moreIcn} color={colors.muted} />
            </Pressable>
          )}
          <Pressable
            onPress={handleReportFlag}
            style={styles.flagBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report prayer"
          >
            <Ionicons name="flag-outline" size={flagIcn} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={[styles.postImage, { marginBottom: postImgMb }]}
      />

      <Text style={[styles.prayerContent, { fontSize: fsPrayer, lineHeight: lhPrayer, marginBottom: prayerMb }]}>
        {post.content}
      </Text>

      <View style={[styles.divider, { marginBottom: dividerMb }]} />

        <View style={[styles.reactionsRow, { marginBottom: reactMb }]}>
          <View style={[styles.prayCount, { gap: prayCountGap }]}>
            <Ionicons name="flame-outline" size={flameIcn} color={colors.flame} />
            <Text style={[styles.prayCountText, { fontSize: fsPrayCount }]}>
              {post.prayCount} {post.prayCount === 1 ? "person" : "people"} praying
            </Text>
          </View>
        </View>

      {threadOpen ? (
        <>
          <Text style={[styles.commentsSectionTitle, { fontSize: fsCommentsTitle, marginBottom: commentsTitleMb }]}>
            Comments
          </Text>
          {commentsLoading && (
            <View style={[styles.commentsLoadingRow, { paddingVertical: commentsLoadPadV, marginBottom: commentsLoadMb }]}>
              <ActivityIndicator color={colors.flame} size="small" />
            </View>
          )}
        </>
      ) : (
        <Text style={[styles.replyHint, { fontSize: fsReplyHint, marginBottom: replyHintMb }]}>
          Replying to {authorName}
        </Text>
      )}
    </>
  );

  const renderComment = ({ item }: { item: CommentRow }) => {
    const name = item.authorDisplayName ?? item.authorUsername ?? "User";
    const initial = (name[0] ?? "?").toUpperCase();
    return (
      <View
        style={[
          styles.commentCard,
          {
            gap: commentCardGap,
            borderRadius: commentCardRad,
            padding: commentCardPad,
            marginBottom: commentCardMb,
          },
        ]}
      >
        <View style={[styles.commentAvatar, { width: commentAv, height: commentAv, borderRadius: commentAv / 2 }]}>
          <Text style={[styles.commentAvatarText, { fontSize: commentAvFs }]}>{initial}</Text>
        </View>
        <View style={styles.commentBody}>
          <View style={[styles.commentMetaRow, { gap: metaGap, marginBottom: metaRowMb }]}>
            <Text style={[styles.commentAuthorName, { fontSize: fsComAuthor }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.commentTime, { fontSize: fsComTime }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={[styles.commentContent, { fontSize: fsComContent, lineHeight: lhComContent }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? kbOffset : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={threadOpen ? comments : []}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderComment}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          threadOpen && !commentsLoading ? (
            <Text style={[styles.emptyComments, { fontSize: emptyFs, marginBottom: emptyMb }]}>No comments yet</Text>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { padding: listPad, paddingBottom: 8, maxWidth: listMaxW }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.stickyComposer, { gap: stickyGap, paddingHorizontal: stickyPadH, paddingVertical: stickyPadV }]}>
        <TextInput
          ref={commentInputRef}
          style={[
            styles.commentInputSticky,
            {
              fontSize: inputFs,
              minHeight: inputMinH,
              maxHeight: inputMaxH,
              paddingVertical: inputPadV,
              paddingHorizontal: inputPadH,
              borderRadius: inputRad,
            },
          ]}
          placeholder={token ? "Add your reply…" : "Sign in to reply"}
          placeholderTextColor={colors.muted}
          value={commentDraft}
          onChangeText={setCommentDraft}
          onFocus={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)}
          multiline
          maxLength={2000}
          editable={!!token && !commentSubmitting}
          textAlignVertical="center"
        />
        <Pressable
          onPress={() => void submitComment()}
          style={[
            styles.commentSendBtnSticky,
            {
              paddingHorizontal: sendPadH,
              paddingVertical: sendPadV,
            },
            (!commentDraft.trim() || commentSubmitting || !token) && styles.commentSendBtnDisabled,
          ]}
          disabled={!commentDraft.trim() || commentSubmitting || !token}
          accessibilityRole="button"
          accessibilityLabel="Reply"
        >
          {commentSubmitting ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={[styles.commentSendBtnText, { fontSize: sendFs }]}>Reply</Text>
          )}
        </Pressable>
      </View>

      <View
        style={[
          styles.actionBar,
          {
            paddingHorizontal: actionBarPadH,
            paddingTop: actionBarPadT,
            paddingBottom: botPad + actionBarBot,
            gap: actionGap,
          },
        ]}
      >
        <Pressable
          onPress={handlePray}
          style={[
            styles.prayBtn,
            {
              paddingVertical: prayBtnPadV,
              gap: prayBtnGap,
              borderRadius: prayBtnRad,
            },
            post.hasPrayed && styles.prayBtnActive,
          ]}
          testID="pray-btn"
          accessibilityRole="button"
          accessibilityLabel={post.hasPrayed ? "Praying" : "Pray for this"}
        >
          <Animated.View style={{ transform: [{ scale: flameScale }] }}>
            <Ionicons
              name={post.hasPrayed ? "flame" : "flame-outline"}
              size={engageIcn}
              color={post.hasPrayed ? colors.surface : colors.flame}
            />
          </Animated.View>
          <Text style={[styles.prayBtnText, { fontSize: fsPrayBtn }, post.hasPrayed && styles.prayBtnTextActive]}>
            {post.hasPrayed ? "Praying" : "Pray for this"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          style={[
            styles.iconCircleBtn,
            {
              width: iconBtnSz,
              height: iconBtnSz,
              borderRadius: iconBtnRad,
            },
            post.isSaved && styles.iconCircleBtnActive,
          ]}
          testID="save-btn"
          accessibilityRole="button"
          accessibilityLabel={post.isSaved ? "Saved" : "Save to library"}
        >
          <Ionicons
            name={post.isSaved ? "bookmark" : "bookmark-outline"}
            size={engageIcn}
            color={post.isSaved ? colors.surface : colors.primary}
          />
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={[
            styles.iconCircleBtn,
            {
              width: iconBtnSz,
              height: iconBtnSz,
              borderRadius: iconBtnRad,
            },
          ]}
          testID="share-btn"
          accessibilityRole="button"
          accessibilityLabel="Share prayer"
        >
          <Feather name="share-2" size={shareIcn} color={colors.primary} />
        </Pressable>
      </View>

      <Modal
        visible={staffDeleteOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setStaffDeleteOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { padding: modalPad }]}
          onPress={() => setStaffDeleteOpen(false)}
        >
          <Pressable
            style={[styles.modalCard, { padding: modalCardPad, borderRadius: modalRad }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { fontSize: fsModalTitle, marginBottom: modalTitleMb }]}>Reason required</Text>
            <Text style={[styles.modalHelp, { fontSize: fsModalHelp, marginBottom: modalHelpMb }]}>
              Briefly say why you are removing this person&apos;s prayer (team audit).
            </Text>
            <TextInput
              value={staffDeleteReason}
              onChangeText={setStaffDeleteReason}
              placeholder="e.g. policy violation, spam…"
              placeholderTextColor={colors.muted}
              style={[
                styles.modalInput,
                {
                  fontSize: fsModalInput,
                  minHeight: modalInputMinH,
                  padding: modalInputPad,
                  borderRadius: modalInputRad,
                },
              ]}
              multiline
              maxLength={500}
            />
            <View style={[styles.modalActions, { gap: modalActGap, marginTop: modalActMt }]}>
              <Pressable
                onPress={() => setStaffDeleteOpen(false)}
                style={[styles.modalCancel, { paddingVertical: modalCancelPadV, paddingHorizontal: modalCancelPadH }]}
              >
                <Text style={[styles.modalCancelText, { fontSize: fsModalCancel }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const r = staffDeleteReason.trim();
                  if (r.length < 3) {
                    showAppAlert({ title: "Add a bit more", message: "Use at least 3 characters for the reason." });
                    return;
                  }
                  void runDelete({ reason: r });
                }}
                style={[styles.modalDelete, { paddingVertical: modalDelPadV, paddingHorizontal: modalDelPadH }]}
              >
                <Text style={[styles.modalDeleteText, { fontSize: fsModalDel }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  listContent: {
    alignSelf: "center" as const,
    width: "100%",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorPressable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  authorRowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  flagBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {},
  avatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
  },
  authorName: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.text,
  },
  time: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 1,
  },
  categoryBadge: {
    backgroundColor: colors.flameDim,
  },
  categoryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.flame,
  },
  postImage: {},
  prayerContent: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  reactionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  prayCount: {
    flexDirection: "row",
    alignItems: "center",
  },
  prayCountText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  commentsSectionTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.text,
  },
  replyHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.muted,
  },
  stickyComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInputSticky: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentSendBtnSticky: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginBottom: 2,
  },
  commentsLoadingRow: {
    alignItems: "center",
  },
  emptyComments: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  commentCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentAvatar: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.accent,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAuthorName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.text,
    flexShrink: 1,
  },
  commentTime: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  commentContent: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  commentComposerCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  commentInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    minHeight: 72,
    maxHeight: 160,
    padding: 0,
  },
  commentSendBtn: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 32,
  },
  commentSendBtnDisabled: {
    opacity: 0.45,
  },
  commentSendBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  actionBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  prayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.flameDim,
    borderWidth: 1.5,
    borderColor: colors.flame,
  },
  prayBtnActive: {
    backgroundColor: colors.flame,
    borderColor: colors.flame,
  },
  prayBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.flame,
  },
  prayBtnTextActive: {
    color: colors.surface,
  },
  iconCircleBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: colors.surface,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  modalHelp: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  modalInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalCancel: {},
  modalCancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.muted,
  },
  modalDelete: {
    backgroundColor: colors.danger,
    borderRadius: 999,
  },
  modalDeleteText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
});
