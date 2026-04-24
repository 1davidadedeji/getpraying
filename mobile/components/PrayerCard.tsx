import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OfficialPrayer } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

interface PrayerCardProps {
  prayer: OfficialPrayer;
  onPress?: () => void;
}

export default function PrayerCard({ prayer, onPress }: PrayerCardProps) {
  const { uiScale, cardRadius } = useResponsiveLayout();
  const rad = Math.round(clamp(cardRadius, 28, 40));
  const barW = Math.max(3, Math.round(4 * uiScale));
  const marginB = Math.round(clamp(10 * uiScale, 8, 12));
  const borderW = Math.max(1, Math.round(uiScale));
  const contentPad = Math.round(clamp(14 * uiScale, 12, 18));
  const contentGap = Math.round(clamp(4 * uiScale, 3, 5));
  const titleFs = Math.round(clamp(15 * uiScale, 14, 17));
  const authorFs = Math.round(clamp(12 * uiScale, 11, 13));
  const bodyFs = Math.round(clamp(13 * uiScale, 12, 14));
  const bodyLh = Math.round(bodyFs * 1.45);
  const bodyMt = Math.round(clamp(2 * uiScale, 1, 3));
  const tagGap = Math.round(clamp(4 * uiScale, 3, 5));
  const tagMt = Math.round(clamp(4 * uiScale, 3, 5));
  const tagIcon = Math.round(clamp(11 * uiScale, 10, 13));
  const tagTextFs = Math.round(clamp(11 * uiScale, 10, 12));
  const chevronSize = Math.round(clamp(18 * uiScale, 16, 22));
  const chevronMr = Math.round(clamp(12 * uiScale, 10, 14));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: rad,
          marginBottom: marginB,
          borderWidth: borderW,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accentBar, { width: barW, borderTopLeftRadius: rad, borderBottomLeftRadius: rad }]} />
      <View style={[styles.content, { padding: contentPad, gap: contentGap }]}>
        <Text style={[styles.title, { fontSize: titleFs }]}>{prayer.title}</Text>
        {prayer.subtitle && <Text style={[styles.author, { fontSize: authorFs }]}>{prayer.subtitle}</Text>}
        <Text style={[styles.body, { fontSize: bodyFs, lineHeight: bodyLh, marginTop: bodyMt }]} numberOfLines={3}>
          {prayer.content}
        </Text>
        {prayer.category && (
          <View style={[styles.tag, { gap: tagGap, marginTop: tagMt }]}>
            <Feather name="tag" size={tagIcon} color={colors.accent} />
            <Text style={[styles.tagText, { fontSize: tagTextFs }]}>{prayer.category}</Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={chevronSize} color={colors.muted} style={[styles.chevron, { marginRight: chevronMr }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  accentBar: {
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.text,
  },
  author: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    fontStyle: "italic",
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
    textTransform: "capitalize",
  },
  chevron: {
    alignSelf: "center",
  },
});
