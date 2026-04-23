import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useFeedNotice } from "@/context/feedNotice";

/** Renders a non-modal bottom banner when `showNotice` was called (e.g. after posting). */
export function FeedNoticeBanner() {
  const insets = useSafeAreaInsets();
  const { notice, clearNotice } = useFeedNotice();
  const opacity = useRef(new Animated.Value(0)).current;
  const tabBarPad = 56;

  useEffect(() => {
    if (!notice) {
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      clearNotice();
    }, 4200);
    return () => clearTimeout(t);
  }, [notice, clearNotice, opacity]);

  if (!notice) return null;

  const bg = notice.kind === "success" ? colors.primary : colors.textSecondary;
  return (
    <Animated.View
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom + tabBarPad, opacity },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={clearNotice} style={[styles.pill, { backgroundColor: bg }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.surface} />
        <Text style={styles.text}>{notice.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  pill: {
    maxWidth: 400,
    width: "100%",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.surface,
  },
});
