import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { OfficialGuidePlayCircle, type OfficialGuidePlayHandle } from "@/components/OfficialGuidePlayCircle";

type Slot = "morning" | "evening";

const SLOT_THEME: Record<
  Slot,
  { bg: string; accent: string; tag: string; ladder: string; btnBg: string; btnText: string }
> = {
  morning: {
    bg: "#E3EEF9",
    accent: colors.primary,
    tag: "OFFICIAL SANCTUARY",
    ladder: colors.primary,
    btnBg: colors.primary,
    btnText: colors.surface,
  },
  evening: {
    bg: "#F3E8DD",
    accent: "#5C4A3A",
    tag: "VESPER LIGHT",
    ladder: "#5C4A3A",
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
  const title =
    prayer?.title ?? (slot === "morning" ? "Morning Radiance" : "Evening Reflection");
  const body =
    prayer?.subtitle?.trim() ||
    prayer?.content?.trim() ||
    (slot === "morning"
      ? "A guided session to align your heart with the rising sun."
      : "Releasing the day into quiet grace.");

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      <View style={styles.topRow}>
        <MaterialCommunityIcons name="stairs" size={14} color={t.ladder} />
        <Text style={[styles.tag, { color: t.accent }]}>{t.tag}</Text>
        {showSave && prayer && onToggleSave ? (
          <Pressable onPress={onToggleSave} hitSlop={8} style={styles.saveHit} accessibilityRole="button">
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isSaved ? t.accent : t.ladder}
            />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      <Text style={[styles.title, { color: t.accent }]}>{title}</Text>
      <Text style={[styles.desc, { color: t.accent }]} numberOfLines={3}>
        {body}
      </Text>
      <View style={styles.bottomRow}>
        <Pressable
          onPress={() => playRef.current?.toggle()}
          style={[styles.startBtn, { backgroundColor: t.btnBg }]}
          accessibilityRole="button"
          accessibilityLabel="Start prayer audio"
        >
          <Text style={[styles.startBtnText, { color: t.btnText }]}>Start Prayer</Text>
        </Pressable>
        <OfficialGuidePlayCircle ref={playRef} audioUrl={prayer?.audioUrl} size={48} color={t.btnBg} />
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
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    flex: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  saveHit: { marginLeft: "auto" },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    marginBottom: 6,
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  startBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
  },
});
