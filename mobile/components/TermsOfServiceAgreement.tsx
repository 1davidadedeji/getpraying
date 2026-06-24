import { PRIVACY_URL, TERMS_URL } from "@/lib/legalUrls";
import { openLegalDocument } from "@/lib/openLegalDocument";
import colors from "@/constants/colors";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  fontSize?: number;
};

const SUMMARY_POINTS = [
  "Get Praying includes user-generated prayers, comments, and profiles.",
  "You agree not to post harassment, hate, threats, sexual content, or illegal material.",
  "You can report content and block users at any time.",
  "Our team reviews reports and may remove content or suspend accounts that violate these rules.",
  "By creating an account you accept our Terms of Service and Privacy Policy.",
];

export function TermsOfServiceAgreement({ checked, onCheckedChange, fontSize = 13 }: Props) {
  const fs = fontSize;
  const lh = Math.round(fs * 1.45);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { fontSize: fs + 1 }]}>Terms & community guidelines</Text>
      <ScrollView style={styles.summaryScroll} nestedScrollEnabled showsVerticalScrollIndicator>
        {SUMMARY_POINTS.map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={[styles.bullet, { fontSize: fs }]}>•</Text>
            <Text style={[styles.bulletText, { fontSize: fs, lineHeight: lh }]}>{line}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.linksRow}>
        <Pressable onPress={() => void openLegalDocument(TERMS_URL)} accessibilityRole="link">
          <Text style={[styles.link, { fontSize: fs }]}>Terms of Service</Text>
        </Pressable>
        <Text style={[styles.dot, { fontSize: fs }]}>·</Text>
        <Pressable onPress={() => void openLegalDocument(PRIVACY_URL)} accessibilityRole="link">
          <Text style={[styles.link, { fontSize: fs }]}>Privacy Policy</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.checkRow}
        onPress={() => onCheckedChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="I agree to the Terms of Service and community guidelines"
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Feather name="check" size={14} color={colors.surface} /> : null}
        </View>
        <Text style={[styles.checkLabel, { fontSize: fs, lineHeight: lh }]}>
          I agree to the Terms of Service and community guidelines
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  heading: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  summaryScroll: {
    maxHeight: 120,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  bullet: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.muted,
  },
  bulletText: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  linksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  link: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
  },
  dot: {
    color: colors.muted,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.text,
  },
});
