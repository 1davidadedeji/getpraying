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

const CATEGORIES = [
  "anxiety", "gratitude", "healing", "guidance",
  "relationships", "protection", "provision", "grief",
  "hope", "praise", "wisdom", "peace",
];

export default function ComposeScreen() {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { mutate: createPost, isPending } = useCreatePost();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

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
          category: selectedCategory ?? undefined,
        },
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Prayer submitted",
            "Your prayer has been submitted for review.",
            [{ text: "OK", onPress: () => { setContent(""); setIsAnonymous(false); setSelectedCategory(null); router.push("/(tabs)"); } }]
          );
        },
        onError: (err: any) => {
          Alert.alert("Error", err?.data?.error ?? "Could not submit prayer. Please try again.");
        },
      }
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
        <Ionicons name="flame" size={28} color={colors.flame} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Share a Prayer</Text>
          <Text style={styles.subtitle}>Speak your heart. We'll hold space.</Text>
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
        <Text style={styles.sectionLabel}>Category (optional)</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat && styles.categoryChipTextSelected,
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
        <Text style={styles.noticeText}>
          Prayers are reviewed before appearing in the feed.
        </Text>
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
            <Ionicons name="flame" size={20} color={colors.surface} />
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
    gap: 12,
    marginBottom: 4,
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  prayerInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    minHeight: 180,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
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
    borderRadius: 14,
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
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.text,
  },
  optionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  categorySection: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
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
    backgroundColor: colors.flame,
    borderColor: colors.flame,
  },
  categoryChipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.surface,
    fontFamily: "Inter_500Medium",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    flex: 1,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
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
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
});
