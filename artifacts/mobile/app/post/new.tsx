import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreatePost } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

const CATEGORIES = [
  "anxiety",
  "gratitude",
  "healing",
  "guidance",
  "relationships",
  "protection",
  "provision",
  "grief",
  "hope",
  "praise",
  "wisdom",
  "peace",
];

export default function NewPostScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { mutate: createPost, isPending } = useCreatePost();
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = content.trim();
    if (!aiMode) return;
    if (trimmed.length < 20) {
      setAiCategory(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setAiLoading(true);
        const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
        const res = await fetch(`${base}/api/posts/suggest-category`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setAiCategory(typeof data?.category === "string" ? data.category : null);
      } catch {
        if (!cancelled) setAiCategory(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [content, token, aiMode]);

  const handleSubmit = () => {
    if (!content.trim()) {
      Alert.alert("Empty prayer", "Please write your prayer request.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createPost(
      {
        data: {
          content: content.trim(),
          isAnonymous,
          category: (aiMode ? aiCategory : selectedCategory) ?? selectedCategory ?? undefined,
        },
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Prayer submitted", "Your prayer has been submitted for review.", [
            {
              text: "OK",
              onPress: () => {
                setContent("");
                setIsAnonymous(false);
                setSelectedCategory(null);
                router.replace("/(tabs)");
              },
            },
          ]);
        },
        onError: (err: any) => {
          Alert.alert("Error", err?.data?.error ?? "Could not submit prayer. Please try again.");
        },
      },
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 8, paddingBottom: botPad + 40 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Share a Prayer</Text>
            <Text style={styles.subtitle}>Speak your heart. We'll hold space.</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.prayerInput}
          value={content}
          onChangeText={setContent}
          placeholder="Write your prayer request, praise, or devotion..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          maxLength={2000}
          testID="prayer-content-input"
        />
        <Text style={styles.charCount}>{content.length}/2000</Text>
      </View>

      <View style={styles.option}>
        <View style={styles.optionLeft}>
          <Feather name="eye-off" size={18} color={colors.primary} />
          <View>
            <Text style={styles.optionLabel}>Post Anonymously</Text>
            <Text style={styles.optionDesc}>Your name won't be shown</Text>
          </View>
        </View>
        <Switch
          value={isAnonymous}
          onValueChange={setIsAnonymous}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          testID="anonymous-toggle"
        />
      </View>

      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.sectionLabel}>Category</Text>
          {aiLoading ? (
            <Text style={styles.aiHint}>AI thinking…</Text>
          ) : aiCategory ? (
            <Pressable
              onPress={() => setAiMode((v) => !v)}
              style={[styles.aiPill, aiMode ? styles.aiPillOn : styles.aiPillOff]}
              testID="ai-toggle"
            >
              <Text style={[styles.aiPillText, aiMode && styles.aiPillTextOn]}>
                AI suggestion: {aiCategory}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.aiHint}>Optional</Text>
          )}
        </View>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => {
                setAiMode(false);
                setSelectedCategory(selectedCategory === cat ? null : cat);
              }}
              style={[
                styles.categoryChip,
                (aiMode ? aiCategory : selectedCategory) === cat && styles.categoryChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  (aiMode ? aiCategory : selectedCategory) === cat && styles.categoryChipTextSelected,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={styles.noticeText}>Prayers are reviewed before appearing in the feed.</Text>
      </View>

      <Pressable
        style={[styles.submitBtn, (isPending || !content.trim()) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isPending || !content.trim()}
        testID="submit-prayer-btn"
      >
        {isPending ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <>
            <Ionicons name="send" size={18} color={colors.surface} />
            <Text style={styles.submitBtnText}>Submit Prayer</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    gap: 2,
    flex: 1,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  prayerInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    minHeight: 180,
  },
  charCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginTop: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  optionDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  categorySection: {
    gap: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  aiHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  aiPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiPillOn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#93CDFC",
  },
  aiPillOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  aiPillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  aiPillTextOn: {
    color: "#21638D",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.surface,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    flex: 1,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
});

