import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OfficialPrayer } from "@workspace/api-client-react";
import colors from "@/constants/colors";

interface PrayerCardProps {
  prayer: OfficialPrayer;
  onPress?: () => void;
}

export default function PrayerCard({ prayer, onPress }: PrayerCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.title}>{prayer.title}</Text>
        {prayer.subtitle && <Text style={styles.author}>{prayer.subtitle}</Text>}
        <Text style={styles.body} numberOfLines={3}>
          {prayer.content}
        </Text>
        {prayer.category && (
          <View style={styles.tag}>
            <Feather name="tag" size={11} color={colors.accent} />
            <Text style={styles.tagText}>{prayer.category}</Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
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
    width: 4,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  author: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  tagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: colors.accent,
    textTransform: "capitalize",
  },
  chevron: {
    alignSelf: "center",
    marginRight: 12,
  },
});
