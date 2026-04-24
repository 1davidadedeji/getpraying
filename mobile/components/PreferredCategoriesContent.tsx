import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

type Props = {
  preferredCategories: string[];
  onOpenPreferences: () => void;
};

/** Profile “Categories” tab: chips from onboarding, or CTA to set preferences. */
export function PreferredCategoriesContent({ preferredCategories, onOpenPreferences }: Props) {
  const { gutter, uiScale } = useResponsiveLayout();
  const sectionFs = Math.round(clamp(13 * uiScale, 12, 14));
  const sectionLs = clamp(0.8 * uiScale, 0.5, 1.1);
  const chipGap = Math.round(clamp(8 * uiScale, 6, 10));
  const chipMt = Math.round(clamp(12 * uiScale, 10, 14));
  const chipPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const chipPadV = Math.round(clamp(6 * uiScale, 5, 8));
  const chipRad = Math.round(clamp(50 * uiScale, 40, 50));
  const chipTextFs = Math.round(clamp(13 * uiScale, 12, 15));
  const iconSize = Math.round(clamp(36 * uiScale, 32, 42));
  const iconMt = Math.round(clamp(16 * uiScale, 14, 20));
  const hintFs = Math.round(clamp(14 * uiScale, 13, 16));
  const hintMt = Math.round(clamp(8 * uiScale, 6, 10));
  const linkMt = Math.round(clamp(12 * uiScale, 10, 14));
  const linkPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const linkPadH = Math.round(clamp(16 * uiScale, 14, 18));
  const linkTextFs = Math.round(clamp(14 * uiScale, 13, 16));

  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <Text style={[styles.sectionTitle, { fontSize: sectionFs, letterSpacing: sectionLs }]}>
        Prayer categories
      </Text>
      {preferredCategories.length > 0 ? (
        <View style={[styles.chips, { gap: chipGap, marginTop: chipMt }]}>
          {preferredCategories.map((cat) => (
            <View
              key={cat}
              style={[
                styles.chip,
                {
                  paddingHorizontal: chipPadH,
                  paddingVertical: chipPadV,
                  borderRadius: chipRad,
                },
              ]}
            >
              <Text style={[styles.chipText, { fontSize: chipTextFs }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <Ionicons name="grid-outline" size={iconSize} color={colors.muted} style={[styles.icon, { marginTop: iconMt }]} />
          <Text style={[styles.hint, { fontSize: hintFs, marginTop: hintMt }]}>Choose categories in Prayer preferences to show them here.</Text>
          <Pressable
            style={[
              styles.prefLink,
              {
                marginTop: linkMt,
                paddingVertical: linkPadV,
                paddingHorizontal: linkPadH,
              },
            ]}
            onPress={onOpenPreferences}
          >
            <Text style={[styles.prefLinkText, { fontSize: linkTextFs }]}>Open preferences</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "stretch",
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: colors.flameDim,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.flame,
  },
  icon: {
    alignSelf: "center",
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
  prefLink: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    alignSelf: "center",
  },
  prefLinkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.surface,
  },
});
