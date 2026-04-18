import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";

type Props = {
  preferredCategories: string[];
  onOpenPreferences: () => void;
};

/** Profile “Categories” tab: chips from onboarding, or CTA to set preferences. */
export function PreferredCategoriesContent({ preferredCategories, onOpenPreferences }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Prayer categories on your profile</Text>
      {preferredCategories.length > 0 ? (
        <View style={styles.chips}>
          {preferredCategories.map((cat) => (
            <View key={cat} style={styles.chip}>
              <Text style={styles.chipText}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <Ionicons name="grid-outline" size={36} color={colors.muted} style={styles.icon} />
          <Text style={styles.hint}>Choose categories in Prayer preferences to show them here.</Text>
          <Pressable style={styles.prefLink} onPress={onOpenPreferences}>
            <Text style={styles.prefLinkText}>Open preferences</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    alignItems: "stretch",
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: colors.flameDim,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.flame,
  },
  icon: {
    marginTop: 16,
    alignSelf: "center",
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
  prefLink: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 999,
    alignSelf: "center",
  },
  prefLinkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.surface,
  },
});
