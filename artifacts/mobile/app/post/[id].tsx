import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetPost,
  usePrayForPost,
  useSavePost,
  useUnsavePost,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { PostMediaBlock } from "@/components/PostMedia";

const ENGAGE_ICON = 24;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const flameScale = useRef(new Animated.Value(1)).current;
  const [localPost, setLocalPost] = useState<Post | null>(null);

  const { data, isLoading } = useGetPost(Number(id));

  useEffect(() => {
    if (data) setLocalPost(data as any);
  }, [data]);

  const post = localPost ?? (data as any);

  const { mutate: pray } = usePrayForPost();
  const { mutate: save } = useSavePost();
  const { mutate: unsave } = useUnsavePost();

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

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
        onSuccess: (res) =>
          setLocalPost((p) =>
            p ? { ...p, hasPrayed: res.hasPrayed, prayCount: res.prayCount } : p,
          ),
      },
    );
  };

  const handleSave = () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.isSaved) {
      unsave({ postId: post.id }, { onSuccess: () => setLocalPost((p) => p ? { ...p, isSaved: false } : p) });
    } else {
      save({ postId: post.id }, { onSuccess: () => setLocalPost((p) => p ? { ...p, isSaved: true } : p) });
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const authorName = post.isAnonymous
      ? "Anonymous"
      : post.authorDisplayName ?? post.authorUsername ?? "Someone";
    const message =
      `"${post.content.slice(0, 200)}${post.content.length > 200 ? "\u2026" : ""}"\n\n` +
      `\u2014 shared by ${authorName} on Get Praying\n` +
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

  const comments = (commentsQuery.data as any)?.comments ?? [];

  const submitComment = () => {
    const content = commentDraft.trim();
    if (!content) return;
    createComment.mutate(
      { postId: Number(id), data: { content } },
      {
        onSuccess: () => {
          setCommentDraft("");
          commentsQuery.refetch();
        },
        onError: (err: any) => {
          showAppAlert({
            title: "Could not post comment",
            message: err?.data?.error ?? err?.message ?? "Try again.",
          });
        },
      },
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
          </View>
          {post.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
              </Text>
            </View>
          )}
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

      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  content: {
    padding: 20,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
    marginLeft: "auto",
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
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
});
