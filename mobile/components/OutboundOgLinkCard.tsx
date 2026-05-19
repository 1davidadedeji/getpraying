import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { GestureResponderEvent, Image, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";

type Props = {
  imageUrl?: string | null;
  previewTitle: string;
  previewHost: string;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  variant?: "card" | "detail";
};

/** Shared Open Graph link card (matches feed post link preview visuals). */
export function OutboundOgLinkCard({
  imageUrl,
  previewTitle,
  previewHost,
  onPress,
  accessibilityLabel,
  variant = "card",
}: Props) {
  const isDetail = variant === "detail";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        isDetail ? styles.detailCard : styles.card,
        pressed && (isDetail ? styles.detailCardPressed : styles.cardPressed),
      ]}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? `Open link: ${previewTitle || previewHost}`}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="link-outline" size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={3}>
          {previewTitle || previewHost}
        </Text>
        {previewHost ? (
          <Text style={styles.host} numberOfLines={1}>
            {previewHost}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.88 },
  detailCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailCardPressed: { opacity: 0.88 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  host: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
