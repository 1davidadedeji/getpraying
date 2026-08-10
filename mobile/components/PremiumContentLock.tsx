import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import colors from "@/constants/colors";
import { openPremiumPaywall } from "@/lib/openPremiumPaywall";

type Props = {
  mode?: "text" | "media";
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
};

export function PremiumContentLock({ mode = "text", style, fontSize = 14 }: Props) {
  const isMedia = mode === "media";
  return (
    <Pressable
      onPress={() => openPremiumPaywall()}
      style={({ pressed }) => [styles.wrap, isMedia && styles.mediaWrap, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel="Subscribe to unlock premium content"
    >
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={isMedia ? 22 : 18} color={colors.primary} />
      </View>
      <Text style={[styles.title, { fontSize }]}>{isMedia ? "Subscribe to play" : "Subscribe to read more"}</Text>
      <Text style={[styles.sub, { fontSize: Math.max(12, fontSize - 1) }]}>
        {isMedia
          ? "This audio or video is for premium members."
          : "You're seeing a preview. Unlock the full guide with a subscription."}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: 6,
  },
  mediaWrap: {
    minHeight: 160,
    justifyContent: "center",
  },
  pressed: { opacity: 0.92 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  sub: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
