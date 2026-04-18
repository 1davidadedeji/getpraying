import React from "react";
import { StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";

type Props = { label: string; value: number; /** Slightly smaller value text (e.g. other user profile) */ compact?: boolean };

export function StatCard({ label, value, compact }: Props) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, compact && styles.statValueCompact]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 22,
    color: colors.primary,
  },
  statValueCompact: {
    fontSize: 20,
  },
  statLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
});
