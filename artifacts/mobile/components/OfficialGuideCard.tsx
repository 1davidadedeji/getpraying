import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";

type Props = {
  op: OfficialPrayerRow;
  isSaved?: boolean;
  onToggleSave?: () => void;
  showSave?: boolean;
};

function navigateToGuide(op: OfficialPrayerRow) {
  router.push(`/official/${op.id}` as never);
}

export function OfficialGuideCard({ op, isSaved, onToggleSave, showSave }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.officialCard, pressed && styles.pressed]}
      onPress={() => navigateToGuide(op)}
      accessibilityRole="button"
      accessibilityLabel={`Open guide: ${op.title}`}
    >
      <View style={styles.officialCardTop}>
        <Ionicons name="link-outline" size={16} color={colors.primary} />
        <Text style={styles.officialBadge} numberOfLines={2}>
          {(op.label ?? "OFFICIAL GUIDE").toUpperCase()}
          {op.scheduleSlot ? ` · ${op.scheduleSlot}` : ""}
        </Text>
        {showSave && onToggleSave ? (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onToggleSave(); }}
            hitSlop={8}
            style={styles.saveBtn}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Remove from saved guides" : "Save official guide"}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isSaved ? colors.primary : colors.muted}
            />
          </Pressable>
        ) : null}
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
      <View style={styles.tapHint}>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.85,
  },
  officialCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  saveBtn: {
    marginLeft: "auto",
  },
  officialBadge: {
    flex: 1,
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
  tapHint: {
    position: "absolute",
    right: 14,
    bottom: 14,
  },
});
