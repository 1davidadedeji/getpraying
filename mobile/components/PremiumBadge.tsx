import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "@/constants/colors";

type Props = {
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
  /** locked = free viewer overlay; subscriber = paying member indicator */
  variant?: "locked" | "subscriber";
};

export function PremiumBadge({ style, fontSize = 10, variant = "locked" }: Props) {
  const isSubscriber = variant === "subscriber";
  const iconName = isSubscriber ? "star" : "lock-closed";
  const label = "Premium";
  const a11y = isSubscriber ? "Premium content included in your subscription" : "Premium content";

  return (
    <View style={[styles.badge, isSubscriber && styles.subscriberBadge, style]} accessibilityLabel={a11y}>
      <Ionicons
        name={iconName}
        size={Math.max(9, fontSize - 1)}
        color={isSubscriber ? "#B8860B" : colors.primary}
      />
      <Text style={[styles.text, isSubscriber && styles.subscriberText, { fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriberBadge: {
    backgroundColor: "#FFF8E7",
    borderColor: "#E8D5A3",
  },
  text: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  subscriberText: {
    color: "#8B6914",
  },
});
