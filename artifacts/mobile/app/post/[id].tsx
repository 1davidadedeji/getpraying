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
import colors from "@/constants/colors";

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
          setLocalPost((p) => p ? { ...p, hasPrayed: (res as any).prayed, prayCount: (res as any).count } : p),
      }
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

        <Text style={styles.prayerContent}>{post.content}</Text>

        <View style={styles.divider} />

        <View style={styles.reactionsRow}>
          <View style={styles.prayCount}>
            <Ionicons name="flame" size={20} color={colors.flame} />
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
        >
          <Animated.View style={{ transform: [{ scale: flameScale }] }}>
            <Ionicons
              name={post.hasPrayed ? "flame" : "flame-outline"}
              size={22}
              color={post.hasPrayed ? colors.surface : colors.flame}
            />
          </Animated.View>
          <Text style={[styles.prayBtnText, post.hasPrayed && styles.prayBtnTextActive]}>
            {post.hasPrayed ? "Praying" : "Pray for this"}
          </Text>
        </Pressable>

        <Pressable onPress={handleSave} style={styles.saveBtn} testID="save-btn">
          <Feather
            name="bookmark"
            size={22}
            color={post.isSaved ? colors.accent : colors.muted}
          />
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
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.accent,
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  time: {
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.flame,
  },
  prayerContent: {
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_500Medium",
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
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  prayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.flameDim,
    borderWidth: 1.5,
    borderColor: colors.flame,
  },
  prayBtnActive: {
    backgroundColor: colors.flame,
    borderColor: colors.flame,
  },
  prayBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.flame,
  },
  prayBtnTextActive: {
    color: colors.surface,
  },
  saveBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
