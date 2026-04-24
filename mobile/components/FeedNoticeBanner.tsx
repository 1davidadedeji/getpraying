import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useFeedNotice } from "@/context/feedNotice";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

/** Renders a non-modal bottom banner when `showNotice` was called (e.g. after posting). */
export function FeedNoticeBanner() {
  const insets = useSafeAreaInsets();
  const { gutter, uiScale } = useResponsiveLayout();
  const { notice, clearNotice } = useFeedNotice();
  const opacity = useRef(new Animated.Value(0)).current;
  const tabBarPad = Math.round(clamp(56 * uiScale, 48, 64));
  const pillPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const pillPadH = Math.round(clamp(16 * uiScale, 14, 18));
  const pillGap = Math.round(clamp(8 * uiScale, 6, 10));
  const iconSize = Math.round(clamp(18 * uiScale, 16, 22));
  const textFs = Math.round(clamp(14 * uiScale, 13, 16));
  const maxW = Math.round(clamp(400 * uiScale, 320, 440));

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
        { paddingBottom: insets.bottom + tabBarPad, paddingHorizontal: gutter, opacity },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={clearNotice}
        style={[
          styles.pill,
          {
            backgroundColor: bg,
            paddingVertical: pillPadV,
            paddingHorizontal: pillPadH,
            gap: pillGap,
            maxWidth: maxW,
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={iconSize} color={colors.surface} />
        <Text style={[styles.text, { fontSize: textFs }]}>{notice.message}</Text>
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
  },
  pill: {
    width: "100%",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.surface,
  },
});
