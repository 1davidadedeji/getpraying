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
import { usePrayForPost, useSavePost, useUnsavePost } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { PostMediaBlock } from "@/components/PostMedia";

interface PostCardProps {
  post: Post;
  onUpdated?: (post: Post) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const CATEGORIES: Record<string, string> = {
  anxiety: "Anxiety",
  gratitude: "Gratitude",
  healing: "Healing",
  guidance: "Guidance",
  relationships: "Relationships",
  protection: "Protection",
  provision: "Provision",
  grief: "Grief",
  hope: "Hope",
  praise: "Praise",
  wisdom: "Wisdom",
  peace: "Peace",
};

const ICON_SIZE = 22;

export default function PostCard({ post, onUpdated }: PostCardProps) {
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState(post);

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
  ]);

  const { token } = useAuth();

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const merge = (next: Post) => {
    setLocalPost(next);
    onUpdated?.(next);
  };

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
          merge({
            ...localPost,
            hasPrayed: res.hasPrayed,
            prayCount: res.prayCount,
          });
        },
      },
    );
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (localPost.isSaved) {
      unsave(
        { postId: localPost.id },
        { onSuccess: () => merge({ ...localPost, isSaved: false }) },
      );
    } else {
      save(
        { postId: localPost.id },
        { onSuccess: () => merge({ ...localPost, isSaved: true }) },
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

  const prayColor = localPost.hasPrayed ? colors.flame : colors.muted;
  const bookmarkColor = localPost.isSaved ? colors.primary : colors.muted;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push(`/post/${localPost.id}` as any)}
        style={({ pressed }) => [styles.cardBody, pressed && styles.cardBodyPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open prayer from ${authorName}`}
      >
        <View style={styles.header}>
          <Pressable
            onPress={(e) => {
              if (!localPost.isAnonymous && localPost.authorUsername) {
                e.stopPropagation?.();
                router.push(`/user/${localPost.authorUsername}` as any);
              }
            }}
            disabled={localPost.isAnonymous || !localPost.authorUsername}
            style={styles.authorPressable}
          >
            {!localPost.isAnonymous && localPost.authorAvatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(localPost.authorAvatarUrl)! }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {localPost.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.timeAgo}>{timeAgo(localPost.createdAt)}</Text>
            </View>
          </Pressable>
          {localPost.category && CATEGORIES[localPost.category] && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{CATEGORIES[localPost.category]}</Text>
            </View>
          )}
        </View>

        <PostMediaBlock
          mediaUrl={localPost.mediaUrl}
          mediaType={localPost.mediaType}
          style={styles.media}
        />

        <Text style={styles.content} numberOfLines={4}>
          {localPost.content}
        </Text>
      </Pressable>

      <View style={styles.actions}>
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
              size={ICON_SIZE}
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
            router.push(`/post/${localPost.id}` as any);
          }}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Comments"
        >
          <Ionicons name="chatbubble-outline" size={ICON_SIZE - 2} color={colors.muted} />
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
            size={ICON_SIZE}
            color={bookmarkColor}
          />
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={styles.actionBtn}
          testID="share-btn"
          accessibilityRole="button"
          accessibilityLabel="Share prayer"
        >
          <Feather name="share-2" size={ICON_SIZE - 2} color={colors.muted} />
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
                      const base = getApiBaseUrl();
                      const headers: Record<string, string> = { "Content-Type": "application/json" };
                      if (token) headers.Authorization = `Bearer ${token}`;
                      const res = await fetch(`${base}/api/posts/${localPost.id}/flag`, {
                        method: "POST",
                        headers,
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
          <Ionicons name="flag-outline" size={ICON_SIZE - 2} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardBody: {
    padding: 16,
    paddingBottom: 12,
  },
  cardBodyPressed: {
    opacity: Platform.OS === "web" ? 0.92 : 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  authorPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
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
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
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
});
