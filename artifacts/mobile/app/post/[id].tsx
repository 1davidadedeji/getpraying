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
  getGetSavedPrayersQueryKey,
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
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { timeAgo } from "@/lib/timeAgo";
import { apiUrl, authHeaders } from "@/lib/api";

const ENGAGE_ICON = 24;

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      <View style={styles.authorRow}>
        <Pressable
          onPress={() => {
            if (!post.isAnonymous && post.authorUsername) {
                router.replace(`/user/${post.authorUsername}` as never);
            }
          }}
          disabled={post.isAnonymous || !post.authorUsername}
          style={styles.authorPressable}
        >
          {!post.isAnonymous && post.authorAvatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(post.authorAvatarUrl)! }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        <View style={styles.authorRowRight}>
          {post.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
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
              <Feather name="more-horizontal" size={20} color={colors.muted} />
            </Pressable>
          )}
          <Pressable
            onPress={handleReportFlag}
            style={styles.flagBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report prayer"
          >
            <Ionicons name="flag-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <PostMediaBlock
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        style={styles.postImage}
      />

      <Text style={styles.prayerContent}>{post.content}</Text>

      <View style={styles.divider} />

        <View style={styles.reactionsRow}>
          <View style={styles.prayCount}>
            <Ionicons name="flame-outline" size={18} color={colors.flame} />
            <Text style={styles.prayCountText}>
              {post.prayCount} {post.prayCount === 1 ? "person" : "people"} praying
            </Text>
          </View>
        </View>

      {threadOpen ? (
        <>
          <Text style={styles.commentsSectionTitle}>Comments</Text>
          {commentsLoading && (
            <View style={styles.commentsLoadingRow}>
              <ActivityIndicator color={colors.flame} size="small" />
            </View>
          )}
        </>
      ) : (
        <Text style={styles.replyHint}>Replying to {authorName}</Text>
      )}
    </>
  );

  const renderComment = ({ item }: { item: CommentRow }) => {
    const name = item.authorDisplayName ?? item.authorUsername ?? "User";
    const initial = (name[0] ?? "?").toUpperCase();
    return (
      <View style={styles.commentCard}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>{initial}</Text>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentMetaRow}>
            <Text style={styles.commentAuthorName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.commentContent}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 52 : 0}
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
            <Text style={styles.emptyComments}>No comments yet</Text>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.stickyComposer}>
        <TextInput
          ref={commentInputRef}
          style={styles.commentInputSticky}
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
            (!commentDraft.trim() || commentSubmitting || !token) && styles.commentSendBtnDisabled,
          ]}
          disabled={!commentDraft.trim() || commentSubmitting || !token}
          accessibilityRole="button"
          accessibilityLabel="Reply"
        >
          {commentSubmitting ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={styles.commentSendBtnText}>Reply</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.actionBar, { paddingBottom: botPad + 12 }]}>
        <Pressable
          onPress={handlePray}
          style={[styles.prayBtn, post.hasPrayed && styles.prayBtnActive]}
          testID="pray-btn"
          accessibilityRole="button"
          accessibilityLabel={post.hasPrayed ? "Praying" : "Pray for this"}
        >
          <Animated.View style={{ transform: [{ scale: flameScale }] }}>
            <Ionicons
              name={post.hasPrayed ? "flame" : "flame-outline"}
              size={ENGAGE_ICON}
              color={post.hasPrayed ? colors.surface : colors.flame}
            />
          </Animated.View>
          <Text style={[styles.prayBtnText, post.hasPrayed && styles.prayBtnTextActive]}>
            {post.hasPrayed ? "Praying" : "Pray for this"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          style={[styles.iconCircleBtn, post.isSaved && styles.iconCircleBtnActive]}
          testID="save-btn"
          accessibilityRole="button"
          accessibilityLabel={post.isSaved ? "Saved" : "Save to library"}
        >
          <Ionicons
            name={post.isSaved ? "bookmark" : "bookmark-outline"}
            size={ENGAGE_ICON}
            color={post.isSaved ? colors.surface : colors.primary}
          />
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={styles.iconCircleBtn}
          testID="share-btn"
          accessibilityRole="button"
          accessibilityLabel="Share prayer"
        >
          <Feather name="share-2" size={ENGAGE_ICON - 2} color={colors.primary} />
        </Pressable>
      </View>

      <Modal
        visible={staffDeleteOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setStaffDeleteOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setStaffDeleteOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Reason required</Text>
            <Text style={styles.modalHelp}>
              Briefly say why you are removing this person&apos;s prayer (team audit).
            </Text>
            <TextInput
              value={staffDeleteReason}
              onChangeText={setStaffDeleteReason}
              placeholder="e.g. policy violation, spam…"
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setStaffDeleteOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
                style={styles.modalDelete}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
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
    padding: 20,
    maxWidth: 680,
    alignSelf: "center" as const,
    width: "100%",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  authorPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  authorRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 18,
    color: colors.accent,
  },
  authorName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  time: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  categoryBadge: {
    backgroundColor: colors.flameDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.flame,
  },
  postImage: {
    marginBottom: 20,
  },
  prayerContent: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 18,
    color: colors.text,
    lineHeight: 30,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  reactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  prayCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prayCountText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  commentsSectionTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  replyHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.muted,
    marginBottom: 12,
  },
  stickyComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInputSticky: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: 14,
    backgroundColor: colors.cream,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentSendBtnSticky: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 2,
  },
  commentsLoadingRow: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 8,
  },
  emptyComments: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.muted,
    marginBottom: 16,
  },
  commentCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.accent,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  commentAuthorName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  commentTime: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  commentContent: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
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
    fontSize: 14,
    color: colors.surface,
  },
  actionBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  prayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 32,
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
    fontSize: 15,
    color: colors.flame,
  },
  prayBtnTextActive: {
    color: colors.surface,
  },
  iconCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
    marginBottom: 6,
  },
  modalHelp: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  modalInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.muted,
  },
  modalDelete: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalDeleteText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.surface,
  },
});
