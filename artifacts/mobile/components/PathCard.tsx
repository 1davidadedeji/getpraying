import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PrayerPath } from "@workspace/api-client-react";
import colors from "@/constants/colors";

interface PathCardProps {
  path: PrayerPath;
}

export default function PathCard({ path }: PathCardProps) {
  return (
    <Pressable
      onPress={() => router.push(`/path/${path.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconBg}>
        <Feather name="compass" size={22} color={colors.surface} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{path.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {path.tagline ?? path.description}
        </Text>
        <View style={styles.meta}>
          <Feather name="book-open" size={12} color={colors.muted} />
          <Text style={styles.metaText}>{path.prayerCount} prayers</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
});
