import { Ionicons } from "@expo/vector-icons";
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
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSavePreferences } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

const ALL_CATEGORIES = [
  { key: "anxiety", label: "Anxiety & Worry", icon: "heart-outline" as const },
  { key: "gratitude", label: "Gratitude", icon: "sunny-outline" as const },
  { key: "healing", label: "Healing", icon: "medical-outline" as const },
  { key: "guidance", label: "Guidance", icon: "compass-outline" as const },
  { key: "relationships", label: "Relationships", icon: "people-outline" as const },
  { key: "protection", label: "Protection", icon: "shield-outline" as const },
  { key: "provision", label: "Provision", icon: "leaf-outline" as const },
  { key: "grief", label: "Grief & Loss", icon: "rainy-outline" as const },
  { key: "hope", label: "Hope", icon: "star-outline" as const },
  { key: "praise", label: "Praise & Worship", icon: "musical-notes-outline" as const },
  { key: "wisdom", label: "Wisdom", icon: "bulb-outline" as const },
  { key: "peace", label: "Peace", icon: "cloud-outline" as const },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { refreshUser, user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const { mutate: savePrefs, isPending } = useSavePreferences();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      Alert.alert("Choose categories", "Please select at least one prayer category.");
      return;
    }
    savePrefs(
      { data: { categories: selected } },
      {
        onSuccess: () => {
          if (user) refreshUser({ ...user, onboardingComplete: true, preferredCategories: selected });
          router.replace("/(tabs)");
        },
        onError: () => {
          Alert.alert("Error", "Could not save preferences. Please try again.");
        },
      }
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="flame" size={32} color={colors.accent} />
          <Text style={styles.title}>What will you pray about?</Text>
          <Text style={styles.subtitle}>
            Choose categories that resonate with you. We'll tailor your prayer feed.
          </Text>
        </View>

        <View style={styles.grid}>
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = selected.includes(cat.key);
            return (
              <Pressable
                key={cat.key}
                onPress={() => toggle(cat.key)}
                style={[styles.chip, isSelected && styles.chipSelected]}
                testID={`category-${cat.key}`}
              >
                <Ionicons
                  name={cat.icon}
                  size={20}
                  color={isSelected ? colors.surface : colors.primary}
                />
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 20 }]}>
        <Text style={styles.selectionCount}>
          {selected.length} selected
        </Text>
        <Pressable
          style={[styles.continueBtn, (selected.length === 0 || isPending) && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={selected.length === 0 || isPending}
          testID="continue-btn"
        >
          {isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.continueBtnText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  chipTextSelected: {
    color: colors.surface,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  selectionCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  continueBtn: {
    backgroundColor: colors.accent,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
});
