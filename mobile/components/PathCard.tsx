import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PrayerPath } from "@workspace/api-client-react";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

interface PathCardProps {
  path: PrayerPath;
}

export default function PathCard({ path }: PathCardProps) {
  const { uiScale, cardRadius, iconAction } = useResponsiveLayout();
  const cardPad = Math.round(clamp(14 * uiScale, 12, 18));
  const cardRad = Math.round(clamp(cardRadius, 28, 40));
  const cardGap = Math.round(clamp(12 * uiScale, 10, 14));
  const cardMb = Math.round(clamp(10 * uiScale, 8, 12));
  const iconBg = Math.round(clamp(48 * uiScale, 44, 56));
  const iconRad = iconBg / 2;
  const compassIcn = iconAction;
  const bookIcn = Math.round(clamp(12 * uiScale, 11, 13));
  const chev = Math.round(clamp(18 * uiScale, 16, 20));
  const fsTitle = Math.round(clamp(15 * uiScale, 14, 17));
  const metaGap = Math.round(clamp(4 * uiScale, 3, 5));
  const fsMeta = Math.round(clamp(12 * uiScale, 11, 13));

  return (
    <Pressable
      onPress={() => router.push(`/path/${path.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          padding: cardPad,
          borderRadius: cardRad,
          gap: cardGap,
          marginBottom: cardMb,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconBg, { width: iconBg, height: iconBg, borderRadius: iconRad }]}>
        <Feather name="compass" size={compassIcn} color={colors.surface} />
      </View>
      <View style={[styles.info, { minHeight: Math.round(clamp(52 * uiScale, 48, 56)) }]}>
        <Text
          style={[styles.title, { fontSize: fsTitle, lineHeight: Math.round(fsTitle * 1.25) }]}
          numberOfLines={2}
        >
          {path.name}
        </Text>
        <View style={[styles.meta, { gap: metaGap, marginTop: 4 }]}>
          <Feather name="book-open" size={bookIcn} color={colors.muted} />
          <Text style={[styles.metaText, { fontSize: fsMeta }]}>{path.prayerCount} prayers</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={chev} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  metaText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
});
