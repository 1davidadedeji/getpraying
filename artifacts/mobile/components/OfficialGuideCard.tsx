import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";

export function OfficialGuideCard({ op }: { op: OfficialPrayerRow }) {
  return (
    <View style={styles.officialCard}>
      <View style={styles.officialCardTop}>
        <Ionicons name="link-outline" size={16} color={colors.primary} />
        <Text style={styles.officialBadge}>
          {(op.label ?? "OFFICIAL GUIDE").toUpperCase()}
          {op.scheduleSlot ? ` · ${op.scheduleSlot}` : ""}
        </Text>
      </View>
      <Text style={styles.officialTitle}>{op.title}</Text>
      {op.subtitle ? (
        <Text style={styles.officialSubtitle} numberOfLines={3}>
          {op.subtitle}
        </Text>
      ) : (
        <Text style={styles.officialSubtitle} numberOfLines={3}>
          {op.content}
        </Text>
      )}
      {op.uploadedByUsername || op.uploadedByDisplayName ? (
        <Text style={styles.uploadedBy}>
          Uploaded by{" "}
          {op.uploadedByUsername ? `@${op.uploadedByUsername}` : op.uploadedByDisplayName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  officialCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  officialCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  officialBadge: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  officialTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
    marginBottom: 6,
  },
  officialSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  uploadedBy: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
  },
});
