import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, type Href } from "expo-router";
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
import { ApiError } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { PostMediaBlock } from "@/components/PostMedia";
import { PremiumGatedContent } from "@/components/PremiumGatedContent";
import { CommentRichBodyWithOgLink } from "@/components/CommentLinkPreview";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import { OutboundOgLinkCard } from "@/components/OutboundOgLinkCard";
import { showAppAlert } from "@/components/AppAlert";
import { useOpenGraphPreviewState } from "@/hooks/useOpenGraphPreviewState";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { timeAgo } from "@/lib/timeAgo";
import { apiFetch } from "@/lib/api";
import { showPostSafetyMenu } from "@/lib/postSafetyMenu";
import { goBackOrFallback } from "@/lib/goBackOrFallback";
import { buildPostSharePayload } from "@/lib/sharePost";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { subscribeAppActive } from "@/lib/appResume";
import { publishPostEngagement, publishPostRemoved } from "@/lib/postEngagementSync";
import { subscribePostDetailRefresh } from "@/lib/postDetailRefresh";
import { isNotFoundError, LIVE_COMMENTS_POLL_MS, LIVE_POST_POLL_MS } from "@/lib/liveSync";
import { useScreenFocused } from "@/hooks/useScreenFocused";
import { isPremiumContentLocked, isPremiumMediaLocked } from "@/lib/premiumContent";
import { usePremiumViewer } from "@/lib/premiumViewer";
import { clamp } from "@/lib/responsiveMetrics";

type CommentRow = {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
};

export default function PostDetailScreen() {
  useStackHeaderBack("/(tabs)" as Href);
  const { id, focusMedia, fromProfile } = useLocalSearchParams<{
    id: string;
    focusMedia?: string;
    fromProfile?: string;
  }>();
  const postId = Number(id);
  const insets = useSafeAreaInsets();
  const { user, token, loading: authLoading } = useAuth();
  const { subscribed, shouldBlur } = usePremiumViewer();
  const authReady = !authLoading && Boolean(token);
  const [staffDeleteOpen, setStaffDeleteOpen] = useState(false);
  const [staffDeleteReason, setStaffDeleteReason] = useState("");
  const queryClient = useQueryClient();
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [postUnavailable, setPostUnavailable] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const engageMutationPendingRef = useRef(0);

  const fromProfileUsername = useMemo(() => {
    const v = Array.isArray(fromProfile) ? fromProfile[0] : fromProfile;
    return typeof v === "string" && v.length > 0 ? v : null;
  }, [fromProfile]);
  const mediaFirst = useMemo(() => {
    const v = Array.isArray(focusMedia) ? focusMedia[0] : focusMedia;
    return v === "1" || v === "true";
  }, [focusMedia]);
  const [bodyExpanded, setBodyExpanded] = useState(() => mediaFirst);

  useEffect(() => {
    if (mediaFirst) setBodyExpanded(true);
  }, [mediaFirst]);

  const screenFocused = useScreenFocused();

  useEffect(() => {
    setPostUnavailable(false);
  }, [postId]);

  const { data, isLoading, isError, error } = useGetPost(Number(id), {
    query: {
      queryKey: getGetPostQueryKey(postId),
      enabled: Number.isFinite(postId) && !postUnavailable && authReady,
      refetchInterval: screenFocused && !postUnavailable ? LIVE_POST_POLL_MS : false,
    },
  });

  const postNotFound = postUnavailable || (isError && isNotFoundError(error));

  useEffect(() => {
    if (engageMutationPendingRef.current > 0) return;
    if (data) setLocalPost(data as Post);
  }, [data]);

  useEffect(() => {
    if (!data || engageMutationPendingRef.current > 0) return;
    const p = data as Post & { commentCount?: number; hasCommented?: boolean };
    publishPostEngagement({
      postId: p.id,
      commentCount: p.commentCount,
      hasCommented: p.hasCommented,
      prayCount: p.prayCount,
      hasPrayed: p.hasPrayed,
      isSaved: p.isSaved,
    });
  }, [data]);

  useEffect(() => {
    if (!authLoading && token && Number.isFinite(postId)) {
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
    }
  }, [authLoading, token, postId, queryClient]);

  const post = localPost ?? (data as any);

  const postOgSource =
    post && typeof post.content === "string" && post.content !== "(Image)"
      ? post.content
      : "";

  const ogPrayer = useOpenGraphPreviewState(postOgSource, post?.id ?? 0);

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const engageIcn = Math.round(clamp(24 * uiScale, 20, 28));
  const shareIcn = Math.max(16, engageIcn - 2);
  const flagIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const moreIcn = Math.round(clamp(20 * uiScale, 18, 22));
  const listPad = gutter;
  const authorGap = Math.round(clamp(10 * uiScale, 8, 12));
  const authorRowMb = Math.round(clamp(20 * uiScale, 16, 24));
  const avatarSz = Math.round(clamp(38 * uiScale, 34, 44));
  const avatarFs = Math.round(16 * uiScale);
  const fsAuthorName = Math.round(clamp(14 * uiScale, 13, 15));
  const fsTime = Math.round(clamp(12 * uiScale, 11, 13));
  const catPadH = Math.round(clamp(8 * uiScale, 6, 10));
  const catPadV = Math.round(clamp(3 * uiScale, 2, 4));
  const catRad = Math.round(clamp(8 * uiScale, 6, 10));
  const fsCat = Math.round(clamp(11 * uiScale, 10, 12));
  const rightGap = Math.round(clamp(8 * uiScale, 6, 10));
  const postImgMb = Math.round(clamp(16 * uiScale, 12, 20));
  const fsPrayer = Math.round(clamp(15 * uiScale, 14, 16));
  const lhPrayer = Math.round(fsPrayer * 2);
  const prayerMb = Math.round(clamp(20 * uiScale, 16, 24));
  const dividerMb = Math.round(clamp(14 * uiScale, 12, 16));
  const flameIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const fsPrayCount = Math.round(clamp(13 * uiScale, 12, 14));
  const fsCommentsTitle = Math.round(clamp(13 * uiScale, 12, 14));
  const commentsTitleMb = Math.round(clamp(10 * uiScale, 8, 12));
  const commentsLoadPadV = Math.round(clamp(14 * uiScale, 12, 16));
  const commentsLoadMb = Math.round(clamp(6 * uiScale, 5, 8));
  const stickyGap = Math.round(clamp(8 * uiScale, 6, 10));
  const stickyPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const stickyPadV = Math.round(clamp(8 * uiScale, 6, 10));
  const inputFs = Math.round(clamp(14 * uiScale, 13, 15));
  const inputMinH = Math.round(clamp(36 * uiScale, 32, 42));
  const inputMaxH = Math.round(clamp(110 * uiScale, 90, 130));
  const inputPadV = Math.round(Platform.OS === "ios" ? clamp(8 * uiScale, 6, 10) : clamp(6 * uiScale, 5, 8));
  const inputPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const inputRad = Math.round(clamp(18 * uiScale, 14, 22));
  const sendPadH = Math.round(clamp(16 * uiScale, 14, 20));
  const sendPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const sendFs = Math.round(clamp(13 * uiScale, 12, 14));
  const emptyFs = Math.round(clamp(13 * uiScale, 12, 14));
  const emptyMb = Math.round(clamp(14 * uiScale, 12, 16));
  const commentCardPad = Math.round(clamp(14 * uiScale, 12, 16));
  const commentCardRad = cardRadius;
  const commentCardMb = Math.round(clamp(10 * uiScale, 8, 12));
  const commentCardGap = Math.round(clamp(10 * uiScale, 8, 12));
  const commentAv = Math.round(clamp(34 * uiScale, 30, 38));
  const commentAvFs = Math.round(clamp(13 * uiScale, 12, 14));
  const fsComAuthor = Math.round(clamp(13 * uiScale, 12, 14));
  const fsComTime = Math.round(clamp(11 * uiScale, 10, 12));
  const metaRowMb = Math.round(clamp(3 * uiScale, 2, 4));
  const metaGap = Math.round(clamp(6 * uiScale, 5, 8));
  const fsComContent = Math.round(clamp(14 * uiScale, 13, 15));
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
  const detailCardPad = Math.round(clamp(16 * uiScale, 14, 18));
  const detailCardRad = Math.round(clamp(cardRadius, 28, 40));
  const detailCardBorder = Math.max(1, Math.round(1.5 * uiScale));
  const detailCardOuterMb = Math.round(clamp(16 * uiScale, 14, 20));

  const loadComments = useCallback(async (opts?: { silent?: boolean }) => {
    if (!post?.id) return;
    if (!opts?.silent) setCommentsLoading(true);
    try {
      const res = await apiFetch(`/posts/${post.id}/comments`, { token });
      if (res.status === 404) {
        setPostUnavailable(true);
        setComments([]);
        return;
      }
      if (!res.ok) {
        if (!opts?.silent) setComments([]);
        return;
      }
      const dataJson = await res.json();
      const list = (dataJson.comments ?? []) as CommentRow[];
      setComments(list);
      if (post?.id) {
        const userCommented =
          user?.id != null && list.some((c) => c.authorId === user.id);
        publishPostEngagement({
          postId: post.id,
          commentCount: list.length,
          hasCommented: userCommented,
        });
        setLocalPost((p) =>
          p
            ? ({
                ...p,
                commentCount: list.length,
                hasCommented: userCommented,
              } as Post)
            : p,
        );
      }
    } catch {
      if (!opts?.silent) setComments([]);
    } finally {
      if (!opts?.silent) setCommentsLoading(false);
    }
  }, [post?.id, token, user?.id]);

  useEffect(() => {
    if (post?.id && !postNotFound) void loadComments();
  }, [post?.id, postNotFound, loadComments]);

  useEffect(() => {
    if (!post?.id || !screenFocused || postNotFound) return;
    const interval = setInterval(() => {
      void loadComments({ silent: true });
    }, LIVE_COMMENTS_POLL_MS);
    return () => clearInterval(interval);
  }, [post?.id, screenFocused, postNotFound, loadComments]);

  useEffect(() => {
    return subscribePostDetailRefresh((refreshedId) => {
      if (!Number.isFinite(postId) || refreshedId !== postId) return;
      void loadComments();
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
  }, [postId, loadComments, queryClient]);

  useEffect(() => {
    return subscribeAppActive(() => {
      if (!Number.isFinite(postId)) return;
      // Invalidate TanStack query only — it will refetch the post and the
      // live-poll interval handles comments. Firing both simultaneously was
      // creating a 2-connection burst that saturated the NSURLSession pool.
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
    }, 450);
  }, [postId, queryClient]);

  const openAuthorProfile = useCallback(() => {
    if (!post || post.isAnonymous || !post.authorUsername) return;
    if (
      fromProfileUsername &&
      fromProfileUsername.toLowerCase() === post.authorUsername.toLowerCase()
    ) {
      return;
    }
    router.push(`/user/${post.authorUsername}` as never);
  }, [fromProfileUsername, post]);

  // Scroll list to end when keyboard appears so the comment input stays visible
  useEffect(() => {
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  const isOwner = !!user && !!post && user.id === (post as any).authorId;
  const isAdmin = user?.role === "admin" || user?.role === "moderator";

  const runDelete = async (opts?: { reason?: string }) => {
    if (!post) return;
    try {
      const body =
        opts?.reason && opts.reason.length >= 3
          ? JSON.stringify({ reason: opts.reason })
          : undefined;
      const res = await apiFetch(`/posts/${post.id}`, {
        method: "DELETE",
        token,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (res.ok) {
        publishPostRemoved(post.id);
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
        goBackOrFallback("/(tabs)" as Href);
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

  const ensureSignedIn = (): boolean => {
    if (authLoading) return false;
    if (token) return true;
    showAppAlert({
      title: "Sign in required",
      message: "Sign in to pray for and save prayers.",
      buttons: [{ text: "Sign In", onPress: () => router.push("/login" as never) }],
    });
    return false;
  };

  const canEngage = authReady;

  const handleMutationError = (err: unknown, action: string) => {
    if (err instanceof ApiError && err.status === 401) {
      showAppAlert({
        title: "Session expired",
        message: "Please sign in again to continue.",
        buttons: [{ text: "Sign In", onPress: () => router.push("/login" as never) }],
      });
      return;
    }
    showAppAlert({
      title: `Could not ${action}`,
      message: getApiErrorMessage(err, "Please try again."),
    });
  };

  const handlePray = () => {
    if (!post || !ensureSignedIn()) return;
    Animated.sequence([
      Animated.spring(flameScale, { toValue: 1.5, useNativeDriver: true }),
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const prevPrayed = post.hasPrayed;
    const prevCount = post.prayCount;
    engageMutationPendingRef.current += 1;
    setLocalPost((p) =>
      p
        ? {
            ...p,
            hasPrayed: !prevPrayed,
            prayCount: prevPrayed ? Math.max(0, prevCount - 1) : prevCount + 1,
          }
        : p,
    );

    pray(
      { postId: post.id },
      {
        onSuccess: (res) => {
          setLocalPost((p) =>
            p ? { ...p, hasPrayed: res.hasPrayed, prayCount: res.prayCount } : p,
          );
          publishPostEngagement({
            postId: post.id,
            hasPrayed: res.hasPrayed,
            prayCount: res.prayCount,
          });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
          if (post.authorUsername) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProfileQueryKey(post.authorUsername),
            });
          }
        },
        onError: (err) => {
          setLocalPost((p) =>
            p ? { ...p, hasPrayed: prevPrayed, prayCount: prevCount } : p,
          );
          handleMutationError(err, "update your prayer");
        },
        onSettled: () => {
          engageMutationPendingRef.current = Math.max(0, engageMutationPendingRef.current - 1);
        },
      },
    );
  };

  const handleSave = () => {
    if (!post || !ensureSignedIn()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevSaved = post.isSaved;
    const prevSaveCount = (post as Post & { saveCount?: number }).saveCount ?? 0;
    engageMutationPendingRef.current += 1;
    setLocalPost((p) =>
      p
        ? {
            ...p,
            isSaved: !prevSaved,
            saveCount: prevSaved ? Math.max(0, prevSaveCount - 1) : prevSaveCount + 1,
          }
        : p,
    );
    const invalidateSaved = () => {
      queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
    };
    const onSettled = () => {
      engageMutationPendingRef.current = Math.max(0, engageMutationPendingRef.current - 1);
    };
    if (prevSaved) {
      unsave(
        { postId: post.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((p) => (p ? { ...p, isSaved: res.isSaved, saveCount: res.saveCount } : p));
            publishPostEngagement({
              postId: post.id,
              isSaved: res.isSaved,
              saveCount: res.saveCount,
            });
            invalidateSaved();
          },
          onError: (err) => {
            setLocalPost((p) =>
              p ? { ...p, isSaved: prevSaved, saveCount: prevSaveCount } : p,
            );
            handleMutationError(err, "unsave this prayer");
          },
          onSettled,
        },
      );
    } else {
      save(
        { postId: post.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((p) => (p ? { ...p, isSaved: res.isSaved, saveCount: res.saveCount } : p));
            publishPostEngagement({
              postId: post.id,
              isSaved: res.isSaved,
              saveCount: res.saveCount,
            });
            invalidateSaved();
          },
          onError: (err) => {
            setLocalPost((p) =>
              p ? { ...p, isSaved: prevSaved, saveCount: prevSaveCount } : p,
            );
            handleMutationError(err, "save this prayer");
          },
          onSettled,
        },
      );
    }
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      Haptics.selectionAsync();
      const { message } = buildPostSharePayload(post);
      await Share.share({ message }, { dialogTitle: "Share this prayer" });
    } catch {
      // silently ignore user cancellation
    }
  };

  const handleReportFlag = () => {
    if (!post) return;
    Haptics.selectionAsync();
    showPostSafetyMenu({
      postId: post.id,
      authorUsername: post.authorUsername,
      token,
      onBlocked: () => {
        router.replace("/(tabs)" as Href);
      },
    });
  };

  const submitComment = async () => {
    if (!post || !commentDraft.trim()) return;
    if (authLoading) return;
    if (!token) {
      showAppAlert({ title: "Sign in required", message: "Please sign in to leave a comment." });
      return;
    }
    setCommentSubmitting(true);
    try {
      const res = await apiFetch(`/posts/${post.id}/comments`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentDraft.trim() }),
      });
      if (res.status === 404) {
        setPostUnavailable(true);
        showAppAlert({ title: "Prayer unavailable", message: "This prayer has been deleted." });
        return;
      }
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
      const nextCount = comments.length + (created ? 1 : 0);
      if (created) setComments((prev) => [...prev, created]);
      setCommentDraft("");
      setLocalPost((p) => {
        if (!p) return p;
        return {
          ...p,
          hasCommented: true,
          commentCount: nextCount,
        } as Post;
      });
      publishPostEngagement({
        postId: post.id,
        hasCommented: true,
        commentCount: nextCount,
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
      if (post.authorUsername) {
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(post.authorUsername) });
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
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

  if (postNotFound) {
    return (
      <View style={[styles.centered, { paddingHorizontal: gutter }]}>
        <Ionicons name="trash-outline" size={48} color={colors.muted} />
        <Text style={styles.unavailableTitle}>This prayer has been deleted</Text>
        <Text style={styles.unavailableSub}>It may have been removed by its author or a moderator.</Text>
        <Pressable
          onPress={() => goBackOrFallback("/(tabs)" as Href)}
          style={({ pressed }) => [styles.unavailableBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.unavailableBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading && !post) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.flame} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.unavailableTitle}>Couldn&apos;t load this prayer</Text>
        <Text style={styles.unavailableSub}>Check your connection and try again.</Text>
        <Pressable
          onPress={() => void queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) })}
          style={({ pressed }) => [styles.unavailableBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading prayer"
        >
          <Text style={styles.unavailableBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  const prayerTextForUi = ogPrayer.showLinkPreview ? ogPrayer.displayTextWithoutUrl : postOgSource;
  const postPremium = post as Post & { isPremium?: boolean; contentLocked?: boolean };
  const contentLocked = isPremiumContentLocked(postPremium);
  const premiumLocked = shouldBlur(postPremium);
  const longBody =
    prayerTextForUi.length > 260 || (prayerTextForUi.match(/\n/g)?.length ?? 0) > 4;

  const listHeader = (
    <>
      <View
        style={[
          styles.detailCard,
          {
            padding: detailCardPad,
            borderRadius: detailCardRad,
            borderWidth: detailCardBorder,
            marginBottom: detailCardOuterMb,
          },
        ]}
      >
        <View style={[styles.authorRow, { gap: authorGap, marginBottom: authorRowMb }]}>
          <View style={styles.headerLeftCluster} pointerEvents="box-none">
            <Pressable
              onPress={openAuthorProfile}
              disabled={post.isAnonymous || !post.authorUsername}
              style={styles.headerAvatarBtn}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Open profile for ${authorName}`}
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
            </Pressable>
            <View style={styles.headerNameRow} pointerEvents="box-none">
              <Pressable
                onPress={openAuthorProfile}
                disabled={post.isAnonymous || !post.authorUsername}
                style={styles.headerNamePressable}
                hitSlop={{ top: 4, bottom: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Open profile for ${authorName}`}
              >
                <View style={styles.headerNameTextCol}>
                  <Text style={[styles.authorName, { fontSize: fsAuthorName }]} numberOfLines={1} ellipsizeMode="tail">
                    {authorName}
                  </Text>
                  <Text style={[styles.time, { fontSize: fsTime }]}>{timeAgo(post.createdAt)}</Text>
                </View>
              </Pressable>
              <View style={styles.headerTapThrough} pointerEvents="box-none" />
            </View>
          </View>
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
            {!isOwner && token ? (
              <Pressable
                onPress={handleReportFlag}
                style={styles.flagBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Report or block"
              >
                <Ionicons name="flag-outline" size={flagIcn} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {postPremium.isPremium ? (
          <PremiumGatedContent
            locked={premiumLocked}
            isPremium
            showSubscriberMarker={subscribed}
            mode={isPremiumMediaLocked(postPremium) ? "media" : "text"}
            minHeight={isPremiumMediaLocked(postPremium) ? 180 : 120}
            style={{ marginBottom: prayerMb }}
          >
            <>
              <PostMediaBlock
                mediaUrl={post.mediaUrl}
                mediaType={post.mediaType}
                isPremium={postPremium.isPremium}
                style={[styles.postImage, { marginBottom: postImgMb }]}
                mediaLayout="detail"
              />

              {(prayerTextForUi.trim().length > 0 || ogPrayer.showLinkPreview) ? (
                <View>
                  {prayerTextForUi.trim().length > 0 ? (
                    <FormattedBodyText
                      text={prayerTextForUi}
                      style={styles.prayerContent}
                      fontSize={fsPrayer}
                      lineHeight={lhPrayer}
                      numberOfLines={bodyExpanded || !longBody ? undefined : 5}
                    />
                  ) : null}
                  {longBody && !contentLocked ? (
                    <Pressable
                      onPress={() => setBodyExpanded((prev) => !prev)}
                      style={styles.moreToggle}
                      accessibilityRole="button"
                      accessibilityLabel={bodyExpanded ? "Show less text" : "Show full prayer text"}
                    >
                      <Text style={[styles.moreToggleText, { fontSize: fsTime + 1 }]}>
                        {bodyExpanded ? "Less" : "More"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {ogPrayer.showLinkPreview ? (
                    <OutboundOgLinkCard
                      variant="detail"
                      imageUrl={ogPrayer.preview?.imageUrl}
                      previewTitle={ogPrayer.previewTitle}
                      previewHost={ogPrayer.previewHost}
                      onPress={() => void ogPrayer.openOutboundLink()}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          </PremiumGatedContent>
        ) : (
          <>
            <PostMediaBlock
              mediaUrl={post.mediaUrl}
              mediaType={post.mediaType}
              isPremium={postPremium.isPremium}
              style={[styles.postImage, { marginBottom: postImgMb }]}
              mediaLayout="detail"
            />

            {(prayerTextForUi.trim().length > 0 || ogPrayer.showLinkPreview) ? (
              <View style={{ marginBottom: prayerMb }}>
                {prayerTextForUi.trim().length > 0 ? (
                  <FormattedBodyText
                    text={prayerTextForUi}
                    style={styles.prayerContent}
                    fontSize={fsPrayer}
                    lineHeight={lhPrayer}
                    numberOfLines={bodyExpanded || !longBody ? undefined : 5}
                  />
                ) : null}
                {longBody && !contentLocked ? (
                  <Pressable
                    onPress={() => setBodyExpanded((prev) => !prev)}
                    style={styles.moreToggle}
                    accessibilityRole="button"
                    accessibilityLabel={bodyExpanded ? "Show less text" : "Show full prayer text"}
                  >
                    <Text style={[styles.moreToggleText, { fontSize: fsTime + 1 }]}>
                      {bodyExpanded ? "Less" : "More"}
                    </Text>
                  </Pressable>
                ) : null}
                {ogPrayer.showLinkPreview ? (
                  <OutboundOgLinkCard
                    variant="detail"
                    imageUrl={ogPrayer.preview?.imageUrl}
                    previewTitle={ogPrayer.previewTitle}
                    previewHost={ogPrayer.previewHost}
                    onPress={() => void ogPrayer.openOutboundLink()}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}

        <View style={[styles.divider, { marginBottom: dividerMb }]} />

        <View style={styles.cardActions}>
          <View style={styles.cardActionsPrimary}>
            <Pressable
              onPress={handlePray}
              style={styles.cardActionBtn}
              testID="pray-btn-inline"
              disabled={!canEngage}
              accessibilityRole="button"
              accessibilityLabel={post.hasPrayed ? "Praying" : "Pray for this post"}
            >
              <Animated.View style={{ transform: [{ scale: flameScale }] }}>
                <Ionicons
                  name={post.hasPrayed ? "flame" : "flame-outline"}
                  size={flameIcn}
                  color={post.hasPrayed ? colors.flame : colors.muted}
                />
              </Animated.View>
              <Text
                style={[
                  styles.cardActionCount,
                  { fontSize: fsPrayCount },
                  post.hasPrayed && styles.cardActionCountActive,
                ]}
              >
                {post.prayCount}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={styles.cardActionBtn}
              testID="save-btn-inline"
              disabled={!canEngage}
              accessibilityRole="button"
              accessibilityLabel={post.isSaved ? "Saved" : "Save to library"}
            >
              <Ionicons
                name={post.isSaved ? "bookmark" : "bookmark-outline"}
                size={flameIcn}
                color={post.isSaved ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.cardActionCount,
                  { fontSize: fsPrayCount },
                  post.isSaved && styles.cardActionCountSaved,
                ]}
              >
                {(post as Post & { saveCount?: number }).saveCount ?? 0}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void handleShare()}
            style={styles.cardActionBtn}
            testID="share-btn-inline"
            accessibilityRole="button"
            accessibilityLabel="Share prayer"
          >
            <Feather name="share-2" size={Math.max(14, flameIcn - 2)} color={colors.muted} />
          </Pressable>
        </View>
      </View>

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
    </>
  );

  const renderComment = ({ item }: { item: CommentRow }) => {
    const name = item.authorDisplayName ?? item.authorUsername ?? "User";
    const initial = (name[0] ?? "?").toUpperCase();
    const avatarUri = item.authorAvatarUrl ? resolveMediaUrl(item.authorAvatarUrl) : null;
    const canNavToProfile = !!item.authorUsername;
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
        <Pressable
          onPress={() => { if (canNavToProfile) router.push(`/user/${item.authorUsername}` as never); }}
          disabled={!canNavToProfile}
          hitSlop={6}
        >
          <View style={[styles.commentAvatar, { width: commentAv, height: commentAv, borderRadius: commentAv / 2 }]}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={[styles.commentAvatarImg, { width: commentAv, height: commentAv, borderRadius: commentAv / 2 }]}
              />
            ) : (
              <Text style={[styles.commentAvatarText, { fontSize: commentAvFs }]}>{initial}</Text>
            )}
          </View>
        </Pressable>
        <View style={styles.commentBody}>
          <View style={[styles.commentMetaRow, { gap: metaGap, marginBottom: metaRowMb }]}>
            <Pressable
              onPress={() => { if (canNavToProfile) router.push(`/user/${item.authorUsername}` as never); }}
              disabled={!canNavToProfile}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 4 }}
            >
              <Text style={[styles.commentAuthorName, { fontSize: fsComAuthor }, canNavToProfile && styles.commentAuthorNameLink]} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
            <Text style={[styles.commentTime, { fontSize: fsComTime }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <CommentRichBodyWithOgLink
            content={item.content}
            textStyle={[styles.commentContent, { fontSize: fsComContent, lineHeight: lhComContent }]}
          />
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
        data={comments}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderComment}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !commentsLoading ? (
            <Text style={[styles.emptyComments, { fontSize: emptyFs, marginBottom: emptyMb }]}>No comments yet</Text>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { padding: listPad, paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollBeginDrag={Keyboard.dismiss}
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
          onBlur={() => Keyboard.dismiss()}
          multiline
          maxLength={2000}
          editable={canEngage && !commentSubmitting}
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
            (!commentDraft.trim() || commentSubmitting || !canEngage) && styles.commentSendBtnDisabled,
          ]}
          disabled={!commentDraft.trim() || commentSubmitting || !canEngage}
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
          disabled={!canEngage}
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
          disabled={!canEngage}
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
  unavailableTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
    marginTop: 16,
    textAlign: "center",
  },
  unavailableSub: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  unavailableBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  unavailableBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.surface,
  },
  detailCard: {
    alignSelf: "center" as const,
    width: "100%" as const,
    maxWidth: 640,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden" as const,
  },
  listContent: {
    alignSelf: "center" as const,
    width: "100%",
    maxWidth: 640,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLeftCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatarBtn: {
    flexShrink: 0,
  },
  headerNameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  headerNamePressable: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  headerNameTextCol: {
    minWidth: 0,
  },
  headerTapThrough: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 8,
    alignSelf: "stretch",
    minHeight: 44,
  },
  moreToggle: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  moreToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  authorRowRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    maxWidth: "46%",
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
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardActionsPrimary: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  cardActionCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.muted,
    minWidth: 20,
  },
  cardActionCountActive: {
    color: colors.flame,
  },
  cardActionCountSaved: {
    color: colors.primary,
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
    overflow: "hidden",
  },
  commentAvatarImg: {},
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
  commentAuthorNameLink: {
    color: colors.primary,
    textDecorationLine: "underline" as const,
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
