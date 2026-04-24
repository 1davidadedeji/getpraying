import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { OfficialGuidePlayCircle, type OfficialGuidePlayHandle } from "@/components/OfficialGuidePlayCircle";

type Slot = "morning" | "evening";

const SLOT_THEME: Record<
  Slot,
  { bg: string; accent: string; icon: React.ComponentProps<typeof Ionicons>["name"]; iconBg: string; btnBg: string; btnText: string }
> = {
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
};

export function SanctuarySlotCard({ slot, prayer, showSave, isSaved, onToggleSave }: Props) {
  const { uiScale } = useResponsiveLayout();
  const playRef = useRef<OfficialGuidePlayHandle>(null);
  const t = SLOT_THEME[slot];
  const slotIcon = Math.round(clamp(40 * uiScale, 36, 46));
  const topIcn = Math.round(18 * uiScale);
  const bookmarkIcn = Math.round(22 * uiScale);
  const playIcn = Math.round(14 * uiScale);
  const playCircle = Math.round(clamp(46 * uiScale, 42, 54));
  const fsTime = Math.round(clamp(10 * uiScale, 9, 11));
  const fsTitle = Math.round(clamp(18 * uiScale, 16, 21));
  const fsDesc = Math.round(clamp(14 * uiScale, 13, 16));
  const lhDesc = Math.round(fsDesc * 1.35);
  const fsScripture = Math.round(clamp(11 * uiScale, 10, 12));
  const fsStart = Math.round(clamp(14 * uiScale, 13, 16));
  const fsDuration = Math.round(clamp(12 * uiScale, 11, 13));
  const rowGap = Math.round(clamp(10 * uiScale, 8, 12));
  const topRowMb = Math.round(clamp(10 * uiScale, 8, 12));
  const descMb = Math.round(clamp(6 * uiScale, 5, 8));
  const scriptureMb = Math.round(clamp(14 * uiScale, 12, 16));
  const btnPadV = Math.round(clamp(11 * uiScale, 10, 13));
  const btnPadH = Math.round(clamp(16 * uiScale, 14, 18));

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
  const timeLabel = slot === "morning" ? "TODAY" : "TONIGHT";
  const topLabel = setByName
    ? `${timeLabel} · SET BY ${setByName.toUpperCase()}`
    : timeLabel;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.bg,
          padding: Math.round(16 * uiScale),
          borderRadius: Math.round(24 * uiScale),
          marginBottom: Math.round(12 * uiScale),
        },
      ]}
    >
      <View style={[styles.topRow, { gap: rowGap, marginBottom: topRowMb }]}>
        <View
          style={[
            styles.slotIconBg,
            {
              backgroundColor: t.iconBg,
              width: slotIcon,
              height: slotIcon,
              borderRadius: slotIcon / 2,
            },
          ]}
        >
          <Ionicons name={t.icon} size={topIcn} color={t.accent} />
        </View>
        <View style={styles.topMeta}>
          <Text style={[styles.timeLabel, { color: t.accent, fontSize: fsTime }]}>{topLabel}</Text>
          <Text style={[styles.title, { color: t.accent, fontSize: fsTitle }]}>{title}</Text>
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

      <Text
        style={[styles.desc, { color: t.accent, fontSize: fsDesc, lineHeight: lhDesc, marginBottom: descMb }]}
        numberOfLines={3}
      >
        {body}
      </Text>

      {prayer?.scripture ? (
        <Text style={[styles.scripture, { color: t.accent, fontSize: fsScripture, marginBottom: scriptureMb }]}>
          — {prayer.scripture}
        </Text>
      ) : null}

      <View style={[styles.bottomRow, { gap: rowGap }]}>
        <Pressable
          onPress={() => playRef.current?.toggle()}
          style={[
            styles.startBtn,
            {
              backgroundColor: t.btnBg,
              paddingVertical: btnPadV,
              paddingHorizontal: btnPadH,
              borderRadius: 999,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start prayer audio"
        >
          <Ionicons name="play" size={playIcn} color={t.btnText} style={{ marginRight: 4 }} />
          <Text style={[styles.startBtnText, { color: t.btnText, fontSize: fsStart }]}>Start Prayer</Text>
        </Pressable>
        {prayer?.durationMinutes ? (
          <Text style={[styles.duration, { color: t.accent, fontSize: fsDuration }]}>{prayer.durationMinutes} min</Text>
        ) : null}
        <OfficialGuidePlayCircle ref={playRef} audioUrl={prayer?.audioUrl} size={playCircle} color={t.btnBg} />
      </View>
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
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  startBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  duration: {
    fontFamily: "PlusJakartaSans_400Regular",
    opacity: 0.6,
  },
});
