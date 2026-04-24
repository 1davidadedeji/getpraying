import React from "react";
import { StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

type Props = { label: string; value: number; /** Slightly smaller value text (e.g. other user profile) */ compact?: boolean };

export function StatCard({ label, value, compact }: Props) {
  const { uiScale, cardRadius } = useResponsiveLayout();
  const pad = Math.round(clamp(14 * uiScale, 12, 18));
  const gap = Math.round(clamp(4 * uiScale, 3, 6));
  const fsValue = Math.round(clamp(22 * uiScale, 19, 26));
  const fsValueCompact = Math.round(clamp(20 * uiScale, 17, 24));
  const fsLabel = Math.round(clamp(11 * uiScale, 10, 12));

  return (
    <View
      style={[
        styles.statCard,
        {
          borderRadius: cardRadius,
          padding: pad,
          gap,
        },
      ]}
    >
      <Text style={[styles.statValue, { fontSize: compact ? fsValueCompact : fsValue }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: fsLabel }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  statLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
});
