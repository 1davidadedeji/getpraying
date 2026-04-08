import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Paths, writeAsStringAsync } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { usePrayForPost, useSavePost, useUnsavePost } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import colors from "@/constants/colors";

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

export default function PostCard({ post, onUpdated }: PostCardProps) {
  const flameScale = useRef(new Animated.Value(1)).current;

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
      { postId: post.id },
      {
        onSuccess: (res) => {
          if (onUpdated) {
            onUpdated({
              ...post,
              hasPrayed: res.hasPrayed,
              prayCount: res.prayCount,
            });
          }
        },
      }
    );
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.isSaved) {
      unsave({ postId: post.id }, { onSuccess: () => onUpdated?.({ ...post, isSaved: false }) });
    } else {
      save({ postId: post.id }, { onSuccess: () => onUpdated?.({ ...post, isSaved: true }) });
    }
  };

  const handleShare = async () => {
    const ok = await Sharing.isAvailableAsync().catch(() => false);
    if (!ok) {
      Alert.alert("Sharing not available", "Sharing isn't available on this device.");
      return;
    }

    const authorName = post.isAnonymous
      ? "Anonymous"
      : post.authorDisplayName ?? post.authorUsername ?? "Someone";
    const text =
      `GetPraying — A prayer shared by ${authorName}\n\n` +
      `${post.content}\n\n` +
      `🙏 ${post.prayCount} praying`;

    const dir = Paths.cache?.uri ?? Paths.document?.uri ?? null;
    if (!dir) {
      Alert.alert("Share failed", "Could not access storage.");
      return;
    }

    const path = `${dir}getpraying-share-${post.id}.txt`;
    await writeAsStringAsync(path, text, { encoding: "utf8" });
    await Sharing.shareAsync(path, { mimeType: "text/plain", dialogTitle: "Share prayer" });
  };

  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Unknown";

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {post.isAnonymous ? "?" : (authorName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
        </View>
        {post.category && CATEGORIES[post.category] && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{CATEGORIES[post.category]}</Text>
          </View>
        )}
      </View>

      <Text style={styles.content} numberOfLines={4}>
        {post.content}
      </Text>

      <View style={styles.actions}>
        <Pressable onPress={handlePray} style={styles.actionBtn} testID="pray-btn">
          <Animated.View style={{ transform: [{ scale: flameScale }] }}>
            <Text
              style={[
                styles.emojiIcon,
                post.hasPrayed ? styles.emojiIconActive : styles.emojiIconInactive,
              ]}
            >
              🙏
            </Text>
          </Animated.View>
          <Text style={[styles.actionCount, post.hasPrayed && styles.actionCountActive]}>
            {post.prayCount}
          </Text>
        </Pressable>

        <Pressable onPress={handleSave} style={styles.actionBtn} testID="save-btn">
          <Text
            style={[
              styles.emojiIcon,
              post.isSaved ? styles.emojiIconActive : styles.emojiIconInactive,
            ]}
          >
            🪜
          </Text>
        </Pressable>

        <Pressable onPress={handleShare} style={styles.actionBtn} testID="share-btn">
          <Text style={[styles.emojiIcon, styles.emojiIconInactive]}>🔗</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  content: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.muted,
  },
  actionCountActive: {
    color: colors.flame,
  },
  emojiIcon: {
    fontSize: 20,
    lineHeight: 22,
  },
  emojiIconActive: {
    opacity: 1,
  },
  emojiIconInactive: {
    opacity: 0.5,
  },
});
