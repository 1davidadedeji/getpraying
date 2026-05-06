import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { PostMediaBlock } from "@/components/PostMedia";
import { timeAgo } from "@/lib/timeAgo";
import { CATEGORY_LABELS } from "@/lib/categories";
import { apiUrl, authHeaders } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

type PostWithCounts = Post & { commentCount?: number; saveCount?: number; hasCommented?: boolean };

interface PostCardProps {
  post: Post;
  onUpdated?: (post: Post) => void;
  replaceNav?: boolean;
  /** Home feed: post id that should autoplay media (muted) when in view */
  feedMediaFocusPostId?: number | null;
}

export default function PostCard({ post, onUpdated, replaceNav, feedMediaFocusPostId }: PostCardProps) {
  const { cardRadius, iconAction, uiScale } = useResponsiveLayout();
  const cardPad = Math.round(clamp(16 * uiScale, 14, 18));
  const avatarSz = Math.round(clamp(38 * uiScale, 34, 44));
  const iconSm = Math.max(17, iconAction - 2);
  const navigate = replaceNav ? router.replace : router.push;
  const queryClient = useQueryClient();
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState<PostWithCounts>(post);

  useEffect(() => {
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

  const { token } = useAuth();

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const handlePray = () => {
    Animated.sequence([
      Animated.spring(flameScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pray(
      { postId: localPost.id },
      {
        onSuccess: (res) => {
          setLocalPost((prev) => {
            const next = { ...prev, hasPrayed: res.hasPrayed, prayCount: res.prayCount };
            onUpdated?.(next);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          if (localPost.authorUsername) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProfileQueryKey(localPost.authorUsername),
            });
          }
        },
      },
    );
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const invalidateSaved = () => {
      queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };
    if (localPost.isSaved) {
      unsave(
        { postId: localPost.id },
        {
          onSuccess: (res: SavePostStateResponse) => {
            setLocalPost((prev) => {
              const next = { ...prev, isSaved: res.isSaved, saveCount: res.saveCount };
              onUpdated?.(next);
              return next;
            });
            invalidateSaved();
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
              onUpdated?.(next);
              return next;
            });
            invalidateSaved();
          },
        },
      );
    }
  };

  const handleShare = async () => {
    const authorName = localPost.isAnonymous
      ? "Anonymous"
      : localPost.authorDisplayName ?? localPost.authorUsername ?? "Someone";
    const message =
      `"${localPost.content.slice(0, 200)}${localPost.content.length > 200 ? "\u2026" : ""}"\n\n` +
      `\u2014 shared by ${authorName} on Get Praying\n` +
      `${localPost.prayCount} ${localPost.prayCount === 1 ? "person" : "people"} praying`;

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

  const prayColor = localPost.hasPrayed ? colors.flame : colors.muted;
  const bookmarkColor = localPost.isSaved ? colors.primary : colors.muted;
  return (
    <View style={[styles.card, { borderRadius: cardRadius, marginBottom: Math.round(12 * uiScale) }]}>
      <Pressable
        onPress={() => navigate(`/post/${localPost.id}` as any)}
        style={({ pressed }) => [
          styles.cardBody,
          { padding: cardPad, paddingBottom: Math.round(cardPad * 0.75) },
          pressed && styles.cardBodyPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open prayer from ${authorName}`}
      >
        <View style={styles.header}>
          <View style={styles.headerLeftCluster} pointerEvents="box-none">
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                if (!localPost.isAnonymous && localPost.authorUsername) {
                  navigate(`/user/${localPost.authorUsername}` as any);
                }
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
                  if (!localPost.isAnonymous && localPost.authorUsername) {
                    navigate(`/user/${localPost.authorUsername}` as any);
                  }
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

        <PostMediaBlock
          mediaUrl={localPost.mediaUrl}
          mediaType={localPost.mediaType}
          style={styles.media}
          compact={localPost.mediaType === "audio"}
          feedMediaFocused={
            feedMediaFocusPostId != null &&
            feedMediaFocusPostId === localPost.id &&
            (localPost.mediaType === "video" || localPost.mediaType === "audio")
          }
          onOpenPostDetail={
            localPost.mediaType === "video"
              ? () => navigate(`/post/${localPost.id}?focusMedia=1` as any)
              : undefined
          }
        />

        <Text style={styles.content} numberOfLines={4}>
          {localPost.content}
        </Text>
      </Pressable>

      <View style={styles.actions}>
        <View style={styles.actionsPrimary}>
          <Pressable
            onPress={handlePray}
            style={styles.actionBtn}
            testID="pray-btn"
            accessibilityRole="button"
            accessibilityLabel={localPost.hasPrayed ? "Praying" : "Pray for this post"}
          >
            <Animated.View style={{ transform: [{ scale: flameScale }] }}>
              <Ionicons
                name={localPost.hasPrayed ? "flame" : "flame-outline"}
                size={iconAction}
                color={prayColor}
              />
            </Animated.View>
            <Text style={[styles.actionCount, localPost.hasPrayed && styles.actionCountActive]}>
              {localPost.prayCount}
            </Text>
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              navigate(`/post/${localPost.id}?focusComment=1` as any);
            }}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Comments"
          >
            <Ionicons
              name={(localPost as PostWithCounts).hasCommented ? "chatbubble" : "chatbubble-outline"}
              size={iconSm}
              color={(localPost as PostWithCounts).hasCommented ? colors.primary : colors.muted}
            />
            <Text
              style={[
                styles.actionCount,
                (localPost as PostWithCounts).hasCommented && styles.actionCountActive,
              ]}
            >
              {localPost.commentCount ?? 0}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            style={styles.actionBtn}
            testID="save-btn"
            accessibilityRole="button"
            accessibilityLabel={localPost.isSaved ? "Remove from saved" : "Save to library"}
          >
            <Ionicons
              name={localPost.isSaved ? "bookmark" : "bookmark-outline"}
              size={iconAction}
              color={bookmarkColor}
            />
            <Text style={[styles.actionCount, localPost.isSaved && styles.actionCountSaved]}>
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
            <Feather name="share-2" size={iconSm} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
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
                        const res = await fetch(apiUrl(`/posts/${localPost.id}/flag`), {
                          method: "POST",
                          headers: authHeaders(token, { "Content-Type": "application/json" }),
                          body: JSON.stringify({ reason: "inappropriate" }),
                        });
                        if (res.ok) {
                          showAppAlert({ title: "Report submitted", message: "Thank you for helping keep the community safe." });
                        } else {
                          const err = await res.json().catch(() => ({}));
                          showAppAlert({ title: "Could not submit report", message: (err as any).error ?? "Please try again." });
                        }
                      } catch {
                        showAppAlert({ title: "Could not submit report", message: "Check your connection." });
                      }
                    },
                  },
                ],
              });
            }}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Report prayer"
          >
            <Ionicons name="flag-outline" size={iconSm} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

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
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
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
