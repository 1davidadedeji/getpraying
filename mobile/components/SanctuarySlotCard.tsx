import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { PremiumGatedContent } from "@/components/PremiumGatedContent";
import { usePremiumViewer } from "@/lib/premiumViewer";
import { premiumCardBorderStyle } from "@/lib/premiumPostTheme";

type Slot = "morning" | "evening";

type SlotTheme = Record<
  Slot,
  {
    bg: string;
    accent: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    iconBg: string;
    btnBg: string;
    btnText: string;
  }
>;

const SLOT_THEME: SlotTheme = {
  morning: {
    bg: "#E3EEF9",
    accent: colors.primary,
    icon: "sunny-outline",
    iconBg: "rgba(26,31,54,0.12)",
    btnBg: colors.primary,
    btnText: colors.surface,
  },
  evening: {
    bg: "#F3E8DD",
    accent: "#5C4A3A",
    icon: "moon-outline",
    iconBg: "rgba(92,74,58,0.12)",
    btnBg: "#5C4A3A",
    btnText: colors.surface,
  },
};

type Props = {
  slot: Slot;
  prayer: OfficialPrayerRow | null;
  showSave?: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** When set, replaces the default Ionicons sun/moon in the slot circle (e.g. branded SVG/mark). */
  leadingSlotIcon?: React.ReactNode;
  /** Tighter layout for the home feed. */
  compact?: boolean;
};

export function SanctuarySlotCard({
  slot,
  prayer,
  showSave,
  isSaved,
  onToggleSave,
  leadingSlotIcon,
  compact = false,
}: Props) {
  const { uiScale } = useResponsiveLayout();
  const { shouldBlur } = usePremiumViewer();
  const t = SLOT_THEME[slot];
  const density = compact ? 0.86 : 1;
  const slotIcon = Math.round(clamp(40 * uiScale * density, compact ? 32 : 36, compact ? 40 : 46));
  const topIcn = Math.round(18 * uiScale * density);
  const bookmarkIcn = Math.round(22 * uiScale * density);
  const fsTime = Math.round(clamp(10 * uiScale * density, 8, compact ? 10 : 11));
  const fsTitle = Math.round(clamp(18 * uiScale * density, compact ? 15 : 16, compact ? 19 : 21));
  const fsDesc = Math.round(clamp(14 * uiScale * density, 12, compact ? 14 : 16));
  const lhDesc = Math.round(fsDesc * 2);
  const fsScripture = Math.round(clamp(11 * uiScale * density, 9, compact ? 10 : 12));
  const fsDuration = Math.round(clamp(12 * uiScale * density, 10, compact ? 11 : 13));
  const rowGap = Math.round(clamp(10 * uiScale * density, 6, compact ? 8 : 12));
  const topRowMb = Math.round(clamp(10 * uiScale * density, 6, compact ? 8 : 12));
  const descMb = Math.round(clamp(6 * uiScale * density, 4, compact ? 6 : 8));
  const scriptureMb = Math.round(clamp(14 * uiScale * density, 8, compact ? 12 : 16));
  const outerPad = Math.round(16 * uiScale * density);
  const cornerRad = Math.round(24 * uiScale * density);
  const cardMb = Math.round(12 * uiScale * density);

  const title = prayer?.title ?? (slot === "morning" ? "Morning Prayer" : "Evening Prayer");
  const body =
    prayer?.subtitle?.trim() ||
    prayer?.content?.trim() ||
    (slot === "morning"
      ? "A guided session to align your heart with the rising sun."
      : "Releasing the day into quiet grace.");

  const setByName =
    prayer?.uploadedByDisplayName ||
    (prayer?.uploadedByUsername ? prayer.uploadedByUsername : null);
  const slotLabel = slot === "morning" ? "MORNING" : "EVENING";
  const topLabel = setByName
    ? `${slotLabel} · SET BY ${setByName.toUpperCase()}`
    : slotLabel;

  const isPremium = Boolean(prayer?.isPremium);
  const premiumLocked = prayer ? shouldBlur(prayer) : false;

  const slotContent = (
    <>
      <FormattedBodyText
        text={body}
        style={[styles.desc, { color: t.accent, marginBottom: descMb }]}
        fontSize={fsDesc}
        lineHeight={lhDesc}
        numberOfLines={compact ? 2 : 3}
      />

      {prayer?.scripture && !compact ? (
        <Text style={[styles.scripture, { color: t.accent, fontSize: fsScripture, marginBottom: scriptureMb }]}>
          — {prayer.scripture}
        </Text>
      ) : null}

      {prayer?.audioUrl ? (
        <CapsuleAudioPlayer
          audioUrl={prayer.audioUrl}
          accentColor={t.accent}
          backgroundColor="rgba(255,255,255,0.45)"
        />
      ) : prayer?.durationMinutes && !compact && !premiumLocked ? (
        <Text style={[styles.duration, { color: t.accent, fontSize: fsDuration }]}>{prayer.durationMinutes} min</Text>
      ) : premiumLocked && isPremium ? (
        <View style={styles.audioPlaceholder} accessibilityLabel="Premium audio locked" />
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.bg,
          padding: outerPad,
          borderRadius: cornerRad,
          marginBottom: cardMb,
        },
        isPremium && premiumCardBorderStyle(true),
      ]}
    >
      <View style={[styles.topRow, { gap: rowGap, marginBottom: topRowMb }]}>
        <View
          style={[
            styles.slotIconBg,
            {
              backgroundColor: leadingSlotIcon ? "transparent" : t.iconBg,
              width: slotIcon,
              height: slotIcon,
              borderRadius: slotIcon / 2,
            },
          ]}
        >
          {leadingSlotIcon ?? <Ionicons name={t.icon} size={topIcn} color={t.accent} />}
        </View>
        <View style={styles.topMeta}>
          <Text style={[styles.timeLabel, { color: t.accent, fontSize: fsTime }]}>{topLabel}</Text>
          <Text style={[styles.title, { color: t.accent, fontSize: fsTitle }]} numberOfLines={compact ? 2 : 3}>
            {title}
          </Text>
        </View>
        {showSave && prayer && onToggleSave ? (
          <Pressable onPress={onToggleSave} hitSlop={10} accessibilityRole="button">
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={bookmarkIcn}
              color={isSaved ? t.accent : t.accent}
              style={{ opacity: isSaved ? 1 : 0.5 }}
            />
          </Pressable>
        ) : null}
      </View>

      {isPremium ? (
        <PremiumGatedContent
          locked={premiumLocked}
          isPremium
          mode={prayer?.audioUrl || premiumLocked ? "media" : "text"}
          minHeight={compact ? 88 : 120}
        >
          {slotContent}
        </PremiumGatedContent>
      ) : (
        slotContent
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  slotIconBg: {
    alignItems: "center",
    justifyContent: "center",
  },
  topMeta: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.8,
    opacity: 0.7,
    marginBottom: 1,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    opacity: 0.85,
  },
  scripture: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontStyle: "italic",
    opacity: 0.6,
  },
  duration: {
    fontFamily: "PlusJakartaSans_400Regular",
    opacity: 0.6,
  },
  audioPlaceholder: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
