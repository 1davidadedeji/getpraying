import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import { EveningGuideMark, MorningGuideMark } from "@/components/guideIcons/MorningEveningMarks";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { clamp } from "@/lib/responsiveMetrics";

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
  const { uiScale, cardRadius, iconAction } = useResponsiveLayout();
  const cardPad = Math.round(clamp(16 * uiScale, 14, 20));
  const cardRad = Math.round(clamp(cardRadius * 0.75, 20, 30));
  const cardMb = Math.round(clamp(12 * uiScale, 10, 14));
  const topGap = Math.round(clamp(6 * uiScale, 5, 8));
  const topMb = Math.round(clamp(8 * uiScale, 6, 10));
  const linkIcn = Math.round(clamp(16 * uiScale, 14, 18));
  const bookmarkIcn = iconAction;
  const hit = Math.round(clamp(8 * uiScale, 6, 10));
  const fsBadge = Math.round(clamp(11 * uiScale, 10, 12));
  const fsTitle = Math.round(clamp(18 * uiScale, 16, 21));
  const titleMb = Math.round(clamp(6 * uiScale, 5, 8));
  const fsSub = Math.round(clamp(14 * uiScale, 13, 16));
  const lhSub = Math.round(fsSub * 2);
  const fsUpload = Math.round(clamp(12 * uiScale, 11, 13));
  const uploadMt = Math.round(clamp(10 * uiScale, 8, 12));
  const hintRight = Math.round(clamp(14 * uiScale, 12, 16));
  const hintBottom = hintRight;
  const chevIcn = Math.round(clamp(14 * uiScale, 13, 16));
  const slotMarkSz = Math.round(clamp(30 * uiScale, 26, 36));
  const slotKey = op.scheduleSlot?.trim().toLowerCase() ?? "";
  const leadMark =
    slotKey === "morning" ? (
      <MorningGuideMark size={slotMarkSz} />
    ) : slotKey === "evening" ? (
      <EveningGuideMark size={slotMarkSz} />
    ) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.officialCard,
        {
          padding: cardPad,
          borderRadius: cardRad,
          marginBottom: cardMb,
        },
        pressed && styles.pressed,
      ]}
      onPress={() => navigateToGuide(op)}
      accessibilityRole="button"
      accessibilityLabel={`Open guide: ${op.title}`}
    >
      <View style={[styles.officialCardTop, { gap: topGap, marginBottom: topMb }]}>
        {leadMark ?? <Ionicons name="link-outline" size={linkIcn} color={colors.primary} />}
        <Text style={[styles.officialBadge, { fontSize: fsBadge }]} numberOfLines={2}>
          {(op.label ?? "OFFICIAL PRAYER").toUpperCase()}
          {op.scheduleSlot ? ` · ${op.scheduleSlot}` : ""}
        </Text>
        {showSave && onToggleSave ? (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onToggleSave(); }}
            hitSlop={hit}
            style={styles.saveBtn}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Remove from saved guides" : "Save official guide"}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={bookmarkIcn}
              color={isSaved ? colors.primary : colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.officialTitle, { fontSize: fsTitle, marginBottom: titleMb }]}>{op.title}</Text>
      {op.subtitle ? (
        <FormattedBodyText
          text={op.subtitle}
          style={styles.officialSubtitle}
          fontSize={fsSub}
          lineHeight={lhSub}
          numberOfLines={3}
        />
      ) : (
        <FormattedBodyText
          text={op.content}
          style={styles.officialSubtitle}
          fontSize={fsSub}
          lineHeight={lhSub}
          numberOfLines={3}
        />
      )}
      {op.uploadedByUsername || op.uploadedByDisplayName ? (
        <Text style={[styles.uploadedBy, { fontSize: fsUpload, marginTop: uploadMt }]}>
          Uploaded by{" "}
          {op.uploadedByUsername ? `@${op.uploadedByUsername}` : op.uploadedByDisplayName}
        </Text>
      ) : null}
      <View style={[styles.tapHint, { right: hintRight, bottom: hintBottom }]}>
        <Ionicons name="chevron-forward" size={chevIcn} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  officialCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  officialCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveBtn: {
    marginLeft: "auto",
  },
  officialBadge: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  officialTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  officialSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  uploadedBy: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  tapHint: {
    position: "absolute",
  },
});
