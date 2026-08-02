import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "@/constants/colors";

type Props = {
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
};

export function PremiumBadge({ style, fontSize = 10 }: Props) {
  return (
    <View style={[styles.badge, style]} accessibilityLabel="Premium content">
      <Ionicons name="lock-closed" size={Math.max(9, fontSize - 1)} color={colors.primary} />
      <Text style={[styles.text, { fontSize }]}>Premium</Text>
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
  text: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
