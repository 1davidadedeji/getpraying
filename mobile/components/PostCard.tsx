import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePrayForPost,
  useSavePost,
  useUnsavePost,
  getGetSavedPrayersQueryKey,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import type { Post, SavePostStateResponse } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import { OutboundOgLinkCard } from "@/components/OutboundOgLinkCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { PostMediaBlock } from "@/components/PostMedia";
import { timeAgo } from "@/lib/timeAgo";
import { CATEGORY_LABELS } from "@/lib/categories";
import { showPostSafetyMenu } from "@/lib/postSafetyMenu";
import { buildPostSharePayload } from "@/lib/sharePost";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { clamp } from "@/lib/responsiveMetrics";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useOpenGraphPreviewState } from "@/hooks/useOpenGraphPreviewState";
import { publishPostEngagement } from "@/lib/postEngagementSync";
import { isPremiumMediaLocked } from "@/lib/premiumContent";
import { PremiumGatedContent } from "@/components/PremiumGatedContent";
import { usePremiumViewer } from "@/lib/premiumViewer";
import { gatePremiumInteraction, isPremiumInteractionBlocked } from "@/lib/premiumInteractionGate";
import { PREMIUM_POST, premiumPostActionColors } from "@/lib/premiumPostTheme";

type PostWithCounts = Post & { commentCount?: number; saveCount?: number; hasCommented?: boolean };

interface PostCardProps {
  post: Post;
  onUpdated?: (post: Post) => void;
  replaceNav?: boolean;
  /** Home feed: post id that should autoplay media (muted) when in view */
  feedMediaFocusPostId?: number | null;
  /** When set, tapping the author won't re-open this profile (avoids profile↔post loops). */
  activeProfileUsername?: string | null;
}

function PostCardInner({
  post,
  onUpdated,
  replaceNav,
  feedMediaFocusPostId,
  activeProfileUsername = null,
}: PostCardProps) {
  const { cardRadius, iconAction, uiScale } = useResponsiveLayout();
  const cardPad = Math.round(clamp(16 * uiScale, 14, 18));
  const avatarSz = Math.round(clamp(38 * uiScale, 34, 44));
  const iconSm = Math.max(17, iconAction - 2);
  const iconMicro = Math.max(14, iconSm - 4);
  const navigate = replaceNav ? router.replace : router.push;
  const queryClient = useQueryClient();
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState<PostWithCounts>(post);
  const og = useOpenGraphPreviewState(localPost.content, localPost.id);

  useEffect(() => {
    if (engageMutationPendingRef.current > 0) return;
    setLocalPost(post);
  }, [
    post.id,
    post.prayCount,
    post.hasPrayed,
    post.isSaved,
    post.content,
    post.createdAt,
    post.category,
    post.isAnonymous,
    post.authorDisplayName,
    post.authorUsername,
    post.mediaUrl,
    post.mediaType,
    (post as PostWithCounts).hasCommented,
    (post as PostWithCounts).commentCount,
    (post as PostWithCounts).saveCount,
  ]);

  const { token, user, loading: authLoading } = useAuth();
  const { subscribed, shouldBlur } = usePremiumViewer();
  const canEngage = !authLoading && Boolean(token);

  const engageMutationPendingRef = useRef(0);

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const ensureSignedIn = (): boolean => {
    if (token) return true;
    showAppAlert({
      title: "Sign in required",
      message: "Sign in to pray for and save prayers.",
      buttons: [{ text: "Sign In", onPress: () => router.push("/login" as never) }],
    });
    return false;
  };

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
    if (gatePremiumInteraction(localPost, subscribed)) return;
    if (authLoading || !ensureSignedIn()) return;
    Animated.sequence([
      Animated.spring(flameScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const prevPrayed = localPost.hasPrayed;
    const prevCount = localPost.prayCount;
    engageMutationPendingRef.current += 1;
    setLocalPost((prev) => ({
      ...prev,
      hasPrayed: !prevPrayed,
      prayCount: prevPrayed ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    pray(
      { postId: localPost.id },
      {
        onSuccess: (res) => {
          setLocalPost((prev) => {
            const next = { ...prev, hasPrayed: res.hasPrayed, prayCount: res.prayCount };
            queueMicrotask(() => {
              onUpdated?.(next);
              publishPostEngagement({
                postId: next.id,
                hasPrayed: next.hasPrayed,
                prayCount: next.prayCount,
              });
            });
            return next;
          });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          if (localPost.authorUsername) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProfileQueryKey(localPost.authorUsername),
            });
          }
        },
        onError: (err) => {
          setLocalPost((prev) => ({
            ...prev,
            hasPrayed: prevPrayed,
            prayCount: prevCount,
          }));
          handleMutationError(err, "update your prayer");
        },
        onSettled: () => {
          engageMutationPendingRef.current = Math.max(0, engageMutationPendingRef.current - 1);
        },
      },
    );
  };

  const handleSave = () => {
    if (gatePremiumInteraction(localPost, subscribed)) return;
    if (authLoading || !ensureSignedIn()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    engageMutationPendingRef.current += 1;
    const invalidateSaved = () => {
      queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };
    if (localPost.isSaved) {
      const prevSaved = localPost.isSaved;
      const prevSaveCount = localPost.saveCount ?? 0;
      const optimisticNext = {
        ...localPost,
        isSaved: false,
        saveCount: Math.max(0, prevSaveCount - 1),
      } as PostWithCounts;
      setLocalPost(optimisticNext);
      onUpdated?.(optimisticNext);
      publishPostEngagement({
        postId: localPost.id,
        isSaved: false,
        saveCount: optimisticNext.saveCount,
      });

      unsave(
        { postId: localPost.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((prev) => {
              const next = { ...prev, isSaved: res.isSaved, saveCount: res.saveCount };
              queueMicrotask(() => {
                onUpdated?.(next);
                publishPostEngagement({
                  postId: next.id,
                  isSaved: next.isSaved,
                  saveCount: (next as PostWithCounts).saveCount,
                });
              });
              return next;
            });
            invalidateSaved();
          },
          onError: (err) => {
            const reverted = {
              ...localPost,
              isSaved: prevSaved,
              saveCount: prevSaveCount,
            } as PostWithCounts;
            setLocalPost(reverted);
            onUpdated?.(reverted);
            publishPostEngagement({
              postId: localPost.id,
              isSaved: true,
              saveCount: prevSaveCount,
            });
            handleMutationError(err, "unsave this prayer");
          },
          onSettled: () => {
            engageMutationPendingRef.current = Math.max(0, engageMutationPendingRef.current - 1);
          },
        },
      );
    } else {
      save(
        { postId: localPost.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((prev) => {
              const next = { ...prev, isSaved: res.isSaved, saveCount: res.saveCount };
              queueMicrotask(() => {
                onUpdated?.(next);
                publishPostEngagement({
                  postId: next.id,
                  isSaved: next.isSaved,
                  saveCount: (next as PostWithCounts).saveCount,
                });
              });
              return next;
            });
            invalidateSaved();
          },
          onError: (err) => handleMutationError(err, "save this prayer"),
          onSettled: () => {
            engageMutationPendingRef.current = Math.max(0, engageMutationPendingRef.current - 1);
          },
        },
      );
    }
  };

  const handleShare = async () => {
    if (gatePremiumInteraction(localPost, subscribed)) return;
    const { message } = buildPostSharePayload(localPost);

    try {
      Haptics.selectionAsync();
      await Share.share({ message }, { dialogTitle: "Share this prayer" });
    } catch {
      // silently ignore user cancellation
    }
  };

  const authorName = localPost.isAnonymous
    ? "Anonymous"
    : localPost.authorDisplayName ?? localPost.authorUsername ?? "Unknown";

  const categoryChips: string[] = (() => {
    const p = localPost as Post & { categories?: string[] };
    if (Array.isArray(p.categories) && p.categories.length > 0) {
      return p.categories.filter((c) => c && CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]);
    }
    return localPost.category && CATEGORY_LABELS[localPost.category as keyof typeof CATEGORY_LABELS]
      ? [localPost.category]
      : [];
  })();

  const isPremiumPost = Boolean((localPost as PostWithCounts).isPremium);
  const premiumBlocked = isPremiumInteractionBlocked(localPost, subscribed);
  const actionColors = premiumPostActionColors(isPremiumPost, {
    hasPrayed: localPost.hasPrayed,
    isSaved: localPost.isSaved,
    hasCommented: (localPost as PostWithCounts).hasCommented,
  });

  const postHref = useMemo(() => {
    const base = `/post/${localPost.id}`;
    if (!activeProfileUsername) return base;
    return `${base}?fromProfile=${encodeURIComponent(activeProfileUsername)}`;
  }, [activeProfileUsername, localPost.id]);

  const openPostDetail = useCallback(() => {
    if (gatePremiumInteraction(localPost, subscribed)) return;
    navigate(postHref as any);
  }, [localPost, subscribed, navigate, postHref]);

  const openComments = useCallback(() => {
    if (gatePremiumInteraction(localPost, subscribed)) return;
    navigate(postHref as any);
  }, [localPost, subscribed, navigate, postHref]);

  const isOwnPost =
    user != null &&
    !localPost.isAnonymous &&
    (localPost.authorId === user.id || localPost.authorUsername === user.username);

  const openAuthorProfile = useCallback(() => {
    if (localPost.isAnonymous || !localPost.authorUsername) return;
    if (
      activeProfileUsername &&
      activeProfileUsername.toLowerCase() === localPost.authorUsername.toLowerCase()
    ) {
      return;
    }
    navigate(`/user/${encodeURIComponent(localPost.authorUsername)}` as any);
  }, [activeProfileUsername, localPost.authorUsername, localPost.isAnonymous, navigate]);

  return (
    <View
      style={[
        styles.card,
        isPremiumPost && styles.cardPremium,
        {
          borderRadius: cardRadius,
          marginBottom: Math.round(12 * uiScale),
          overflow: Platform.OS === "android" ? "visible" : "hidden",
        },
      ]}
    >
      <View
        style={[
          styles.cardBody,
          {
            paddingHorizontal: cardPad,
            paddingTop: cardPad,
            paddingBottom: Math.round(cardPad * 0.75),
          },
        ]}
      >
        {isPremiumPost ? <View style={[styles.premiumBanner, { marginBottom: Math.round(10 * uiScale) }]} /> : null}
        <Pressable
          onPress={openPostDetail}
          style={({ pressed }) => [pressed && !premiumBlocked && styles.cardBodyPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open prayer from ${authorName}`}
        >
          <View style={styles.header}>
            <View style={styles.headerLeftCluster} pointerEvents="box-none">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  openAuthorProfile();
                }}
                disabled={localPost.isAnonymous || !localPost.authorUsername}
                style={styles.headerAvatarBtn}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Open profile for ${authorName}`}
              >
                {!localPost.isAnonymous && localPost.authorAvatarUrl ? (
                  <Image
                    source={{ uri: resolveMediaUrl(localPost.authorAvatarUrl)! }}
                    style={[styles.avatarImg, { width: avatarSz, height: avatarSz, borderRadius: avatarSz / 2 }]}
                  />
                ) : (
                  <View style={[styles.avatar, { width: avatarSz, height: avatarSz, borderRadius: avatarSz / 2 }]}>
                    <Text style={[styles.avatarText, { fontSize: Math.round(16 * uiScale) }]}>
                      {localPost.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.headerNameRow} pointerEvents="box-none">
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openAuthorProfile();
                  }}
                  disabled={localPost.isAnonymous || !localPost.authorUsername}
                  style={styles.headerNamePressable}
                  hitSlop={{ top: 4, bottom: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile for ${authorName}`}
                >
                  <View style={styles.headerInfo}>
                    <Text style={styles.authorName} numberOfLines={1} ellipsizeMode="tail">
                      {authorName}
                    </Text>
                    <Text style={styles.timeAgo}>{timeAgo(localPost.createdAt)}</Text>
                  </View>
                </Pressable>
                <View style={styles.headerTapThrough} pointerEvents="box-none" />
              </View>
            </View>
            <View style={styles.headerRight}>
              {categoryChips.length > 0 && (
                <View style={styles.headerCats}>
                  {categoryChips.map((c) => (
                    <View key={c} style={styles.categoryBadge}>
                      <Text style={styles.categoryText} numberOfLines={1}>
                        {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {(() => {
          const premiumLocked = shouldBlur(localPost);
          const body = (
            <>
              <PostMediaBlock
                postId={localPost.id}
                mediaUrl={localPost.mediaUrl}
                mediaType={localPost.mediaType}
                isPremium={localPost.isPremium}
                style={styles.media}
                compact={localPost.mediaType === "audio"}
                feedMediaFocused={
                  feedMediaFocusPostId != null &&
                  feedMediaFocusPostId === localPost.id &&
                  (localPost.mediaType === "video" || localPost.mediaType === "audio")
                }
                onOpenPostDetail={
                  localPost.mediaType === "video"
                    ? () => {
                        if (gatePremiumInteraction(localPost, subscribed)) return;
                        navigate(
                          `${postHref}${postHref.includes("?") ? "&" : "?"}focusMedia=1` as any,
                        );
                      }
                    : undefined
                }
              />

              {(og.displayTextWithoutUrl.trim().length > 0 || og.showLinkPreview) ? (
                <Pressable
                  onPress={openPostDetail}
                  style={({ pressed }) => [pressed && !premiumBlocked && styles.cardBodyPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open prayer from ${authorName}`}
                >
                  {og.displayTextWithoutUrl.trim().length > 0 ? (
                    <FormattedBodyText
                      text={og.displayTextWithoutUrl}
                      style={styles.content}
                      numberOfLines={4}
                    />
                  ) : null}

                  {og.showLinkPreview ? (
                    <OutboundOgLinkCard
                      imageUrl={og.preview?.imageUrl}
                      previewTitle={og.previewTitle}
                      previewHost={og.previewHost}
                      variant="card"
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void og.openOutboundLink();
                      }}
                      accessibilityLabel={`Open link: ${og.previewTitle || og.previewHost}`}
                    />
                  ) : null}
                </Pressable>
              ) : null}
            </>
          );

          if (!isPremiumPost) return body;

          return (
            <PremiumGatedContent
              locked={premiumLocked}
              isPremium
              mode={isPremiumMediaLocked(localPost) ? "media" : "text"}
              minHeight={isPremiumMediaLocked(localPost) ? 160 : 132}
            >
              {body}
            </PremiumGatedContent>
          );
        })()}
      </View>

      <View
        style={[
          styles.actions,
          isPremiumPost && styles.actionsPremium,
          { paddingHorizontal: cardPad },
        ]}
      >
        <View style={styles.actionsPrimary}>
          <Pressable
            onPress={handlePray}
            style={styles.actionBtn}
            testID="pray-btn"
            disabled={!canEngage && !premiumBlocked}
            accessibilityRole="button"
            accessibilityLabel={localPost.hasPrayed ? "Praying" : "Pray for this post"}
          >
            <Animated.View style={{ transform: [{ scale: flameScale }] }}>
              <Ionicons
                name={localPost.hasPrayed ? "flame" : "flame-outline"}
                size={iconAction}
                color={actionColors.pray}
              />
            </Animated.View>
            <Text
              style={[
                styles.actionCount,
                localPost.hasPrayed && { color: actionColors.countPrayActive },
              ]}
            >
              {localPost.prayCount}
            </Text>
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              openComments();
            }}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Comments"
          >
            <Ionicons
              name={(localPost as PostWithCounts).hasCommented ? "chatbubble" : "chatbubble-outline"}
              size={iconSm}
              color={actionColors.comment}
            />
            <Text
              style={[
                styles.actionCount,
                (localPost as PostWithCounts).hasCommented && { color: actionColors.countCommentActive },
              ]}
            >
              {localPost.commentCount ?? 0}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            style={styles.actionBtn}
            testID="save-btn"
            disabled={!canEngage && !premiumBlocked}
            accessibilityRole="button"
            accessibilityLabel={localPost.isSaved ? "Remove from saved" : "Save to library"}
          >
            <Ionicons
              name={localPost.isSaved ? "bookmark" : "bookmark-outline"}
              size={iconAction}
              color={actionColors.bookmark}
            />
            <Text
              style={[
                styles.actionCount,
                localPost.isSaved && { color: actionColors.countSavedActive },
              ]}
            >
              {localPost.saveCount ?? 0}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionsSecondary}>
          <Pressable
            onPress={handleShare}
            style={styles.actionBtn}
            testID="share-btn"
            accessibilityRole="button"
            accessibilityLabel="Share prayer"
          >
            <Feather name="share-2" size={iconMicro} color={actionColors.share} />
          </Pressable>

          {!isOwnPost && token ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                if (gatePremiumInteraction(localPost, subscribed)) return;
                Haptics.selectionAsync();
                showPostSafetyMenu({
                  postId: localPost.id,
                  authorUsername: localPost.authorUsername,
                  token,
                });
              }}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel="Report or block"
            >
              <Ionicons name="flag-outline" size={iconMicro} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function postCardPropsEqual(prev: PostCardProps, next: PostCardProps): boolean {
  if (prev.post.id !== next.post.id) return false;

  const prevFocused =
    prev.feedMediaFocusPostId != null && prev.feedMediaFocusPostId === prev.post.id;
  const nextFocused =
    next.feedMediaFocusPostId != null && next.feedMediaFocusPostId === next.post.id;
  if (prevFocused !== nextFocused) return false;

  if (prev.replaceNav !== next.replaceNav) return false;
  if (prev.activeProfileUsername !== next.activeProfileUsername) return false;
  if (prev.onUpdated !== next.onUpdated) return false;
  const p = prev.post;
  const n = next.post;
  return (
    p.prayCount === n.prayCount &&
    p.hasPrayed === n.hasPrayed &&
    p.isSaved === n.isSaved &&
    p.content === n.content &&
    p.createdAt === n.createdAt &&
    p.category === n.category &&
    p.isAnonymous === n.isAnonymous &&
    p.authorDisplayName === n.authorDisplayName &&
    p.authorUsername === n.authorUsername &&
    p.mediaUrl === n.mediaUrl &&
    p.mediaType === n.mediaType &&
    (p as PostWithCounts).isPremium === (n as PostWithCounts).isPremium &&
    (p as PostWithCounts).contentLocked === (n as PostWithCounts).contentLocked &&
    (p as PostWithCounts).commentCount === (n as PostWithCounts).commentCount &&
    (p as PostWithCounts).saveCount === (n as PostWithCounts).saveCount &&
    (p as PostWithCounts).hasCommented === (n as PostWithCounts).hasCommented
  );
}

export default React.memo(PostCardInner, postCardPropsEqual);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
    maxWidth: 640,
    alignSelf: "center" as const,
    width: "100%",
  },
  cardPremium: {
    backgroundColor: PREMIUM_POST.cardBg,
    borderColor: PREMIUM_POST.cardBorder,
    shadowColor: PREMIUM_POST.star,
    shadowOpacity: 0.1,
  },
  premiumBanner: {
    height: 3,
    backgroundColor: PREMIUM_POST.bannerBorder,
  },
  cardBody: {},
  cardBodyPressed: {
    opacity: Platform.OS === "web" ? 0.92 : 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
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
  headerTapThrough: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 8,
    alignSelf: "stretch",
    minHeight: 40,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {},
  avatarText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  headerInfo: {
    minWidth: 0,
  },
  authorName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  timeAgo: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    maxWidth: "42%",
  },
  headerCats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-end",
  },
  categoryBadge: {
    backgroundColor: colors.flameDim,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.flame,
  },
  media: {
    marginBottom: 10,
  },
  content: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  actionsPremium: {
    backgroundColor: PREMIUM_POST.actionsBg,
    borderTopColor: PREMIUM_POST.actionsBorder,
  },
  actionsPrimary: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  actionsSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  actionCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.muted,
    minWidth: 20,
  },
  actionCountActive: {
    color: colors.flame,
  },
  actionCountSaved: {
    color: colors.primary,
  },
});
