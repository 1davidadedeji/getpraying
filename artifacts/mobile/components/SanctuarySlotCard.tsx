import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
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
  const playRef = useRef<OfficialGuidePlayHandle>(null);
  const t = SLOT_THEME[slot];

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
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      <View style={styles.topRow}>
        <View style={[styles.slotIconBg, { backgroundColor: t.iconBg }]}>
          <Ionicons name={t.icon} size={18} color={t.accent} />
        </View>
        <View style={styles.topMeta}>
          <Text style={[styles.timeLabel, { color: t.accent }]}>{topLabel}</Text>
          <Text style={[styles.title, { color: t.accent }]}>{title}</Text>
        </View>
        {showSave && prayer && onToggleSave ? (
          <Pressable onPress={onToggleSave} hitSlop={10} accessibilityRole="button">
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isSaved ? t.accent : t.accent}
              style={{ opacity: isSaved ? 1 : 0.5 }}
            />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.desc, { color: t.accent }]} numberOfLines={3}>
        {body}
      </Text>

      {prayer?.scripture ? (
        <Text style={[styles.scripture, { color: t.accent }]}>— {prayer.scripture}</Text>
      ) : null}

      <View style={styles.bottomRow}>
        <Pressable
          onPress={() => playRef.current?.toggle()}
          style={[styles.startBtn, { backgroundColor: t.btnBg }]}
          accessibilityRole="button"
          accessibilityLabel="Start prayer audio"
        >
          <Ionicons name="play" size={14} color={t.btnText} style={{ marginRight: 4 }} />
          <Text style={[styles.startBtnText, { color: t.btnText }]}>Start Prayer</Text>
        </Pressable>
        {prayer?.durationMinutes ? (
          <Text style={[styles.duration, { color: t.accent }]}>{prayer.durationMinutes} min</Text>
        ) : null}
        <OfficialGuidePlayCircle ref={playRef} audioUrl={prayer?.audioUrl} size={46} color={t.btnBg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  slotIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topMeta: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    opacity: 0.7,
    marginBottom: 1,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
    marginBottom: 6,
  },
  scripture: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    fontStyle: "italic",
    opacity: 0.6,
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  startBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
  },
  duration: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    opacity: 0.6,
  },
});
