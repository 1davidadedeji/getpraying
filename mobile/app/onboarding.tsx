import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSavePreferences } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { scriptureStripForToday } from "@/constants/onboardingScripture";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

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
  const { gutter, uiScale } = useResponsiveLayout();
  const { refreshUser, user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const { mutate: savePrefs, isPending } = useSavePreferences();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const contentPadT = Math.round(clamp(20 * uiScale, 16, 24));
  const scrollBot = Math.round(clamp(100 * uiScale, 80, 120));
  const headerIcon = Math.round(clamp(32 * uiScale, 28, 38));
  const headerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const headerMb = Math.round(clamp(28 * uiScale, 22, 34));
  const fsTitle = Math.round(clamp(24 * uiScale, 21, 28));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 1.5);
  const scriptPad = Math.round(clamp(16 * uiScale, 14, 20));
  const scriptRad = Math.round(clamp(20 * uiScale, 18, 24));
  const scriptMb = Math.round(clamp(24 * uiScale, 20, 28));
  const scriptGap = Math.round(clamp(6 * uiScale, 5, 8));
  const fsScriptLabel = Math.round(clamp(11 * uiScale, 10, 12));
  const fsScriptText = Math.round(clamp(15 * uiScale, 14, 17));
  const lhScript = Math.round(fsScriptText * 1.45);
  const fsScriptRef = Math.round(clamp(12 * uiScale, 11, 13));
  const gridGap = Math.round(clamp(10 * uiScale, 8, 12));
  const chipGap = Math.round(clamp(6 * uiScale, 5, 8));
  const chipPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const chipPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const chipRad = Math.round(50 * uiScale);
  const chipIcn = Math.round(clamp(20 * uiScale, 18, 22));
  const fsChip = Math.round(clamp(13 * uiScale, 12, 15));
  const footerPadH = gutter;
  const footerPadT = Math.round(clamp(16 * uiScale, 14, 20));
  const footerBot = Math.round(clamp(20 * uiScale, 16, 26));
  const footerGap = Math.round(clamp(10 * uiScale, 8, 12));
  const fsCount = Math.round(clamp(13 * uiScale, 12, 15));
  const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const btnRad = Math.round(clamp(32 * uiScale, 28, 36));
  const fsBtn = Math.round(clamp(16 * uiScale, 15, 18));

  useEffect(() => {
    if (!user || prefsLoaded) return;
    if ((user.preferredCategories ?? []).length > 0) {
      setSelected([...(user.preferredCategories ?? [])]);
    }
    setPrefsLoaded(true);
  }, [user, prefsLoaded]);

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const strip = scriptureStripForToday();

  const handleContinue = () => {
    if (selected.length === 0) {
      showAppAlert({
        title: "Choose categories",
        message: "Select at least one area you’d like prayer for in your feed.",
      });
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
          showAppAlert({
            title: "Could not save",
            message: "Check your connection and try again.",
          });
        },
      },
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: gutter,
            paddingTop: contentPadT,
            paddingBottom: botPad + scrollBot,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { gap: headerGap, marginBottom: headerMb }]}>
          <Ionicons name="flame" size={headerIcon} color={colors.accent} />
          <Text style={[styles.title, { fontSize: fsTitle }]}>Prayer preferences</Text>
          <Text style={[styles.subtitle, { fontSize: fsSub, lineHeight: lhSub }]}>
            Choose categories for your feed. You can change these anytime in Settings.
          </Text>
        </View>

        <View
          style={[
            styles.scriptureCard,
            {
              borderRadius: scriptRad,
              padding: scriptPad,
              marginBottom: scriptMb,
              gap: scriptGap,
            },
          ]}
        >
          <Text style={[styles.scriptureLabel, { fontSize: fsScriptLabel }]}>Scripture</Text>
          <Text style={[styles.scriptureText, { fontSize: fsScriptText, lineHeight: lhScript }]}>
            &ldquo;{strip.text}&rdquo;
          </Text>
          <Text style={[styles.scriptureRef, { fontSize: fsScriptRef }]}>— {strip.ref}</Text>
        </View>

        <View style={[styles.grid, { gap: gridGap }]}>
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = selected.includes(cat.key);
            return (
              <Pressable
                key={cat.key}
                onPress={() => toggle(cat.key)}
                style={[
                  styles.chip,
                  {
                    gap: chipGap,
                    paddingHorizontal: chipPadH,
                    paddingVertical: chipPadV,
                    borderRadius: chipRad,
                  },
                  isSelected && styles.chipSelected,
                ]}
                testID={`category-${cat.key}`}
              >
                <Ionicons
                  name={cat.icon}
                  size={chipIcn}
                  color={isSelected ? colors.surface : colors.primary}
                />
                <Text style={[styles.chipText, { fontSize: fsChip }, isSelected && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: footerPadH,
            paddingTop: footerPadT,
            paddingBottom: botPad + footerBot,
            gap: footerGap,
          },
        ]}
      >
        <Text style={[styles.selectionCount, { fontSize: fsCount }]}>
          {selected.length} selected
        </Text>
        <Pressable
          style={[
            styles.continueBtn,
            { paddingVertical: btnPadV, borderRadius: btnRad },
            (selected.length === 0 || isPending) && styles.continueBtnDisabled,
          ]}
          onPress={handleContinue}
          disabled={selected.length === 0 || isPending}
          testID="continue-btn"
        >
          {isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.continueBtnText, { fontSize: fsBtn }]}>Continue</Text>
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
  content: {},
  header: {
    alignItems: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
  scriptureCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scriptureLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scriptureText: {
    fontFamily: "NotoSerif_600SemiBold",
    color: colors.text,
  },
  scriptureRef: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    fontStyle: "italic",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectionCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
  continueBtn: {
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
});
