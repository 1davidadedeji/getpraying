import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { OfficialGuidePlayCircle, type OfficialGuidePlayHandle } from "@/components/OfficialGuidePlayCircle";
import { AudioScrubberRow } from "@/components/AudioScrubberRow";

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
  const playRef = useRef<OfficialGuidePlayHandle>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioPositionMs, setAudioPositionMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const t = SLOT_THEME[slot];
  const density = compact ? 0.86 : 1;
  const slotIcon = Math.round(clamp(40 * uiScale * density, compact ? 32 : 36, compact ? 40 : 46));
  const topIcn = Math.round(18 * uiScale * density);
  const bookmarkIcn = Math.round(22 * uiScale * density);
  const playIcn = Math.round(14 * uiScale * density);
  const playCircle = Math.round(clamp(46 * uiScale * density, compact ? 36 : 42, compact ? 44 : 54));
  const fsTime = Math.round(clamp(10 * uiScale * density, 8, compact ? 10 : 11));
  const fsTitle = Math.round(clamp(18 * uiScale * density, compact ? 15 : 16, compact ? 19 : 21));
  const fsDesc = Math.round(clamp(14 * uiScale * density, 12, compact ? 14 : 16));
  const lhDesc = Math.round(fsDesc * 1.35);
  const fsScripture = Math.round(clamp(11 * uiScale * density, 9, compact ? 10 : 12));
  const fsStart = Math.round(clamp(14 * uiScale * density, 12, compact ? 14 : 16));
  const fsDuration = Math.round(clamp(12 * uiScale * density, 10, compact ? 11 : 13));
  const rowGap = Math.round(clamp(10 * uiScale * density, 6, compact ? 8 : 12));
  const topRowMb = Math.round(clamp(10 * uiScale * density, 6, compact ? 8 : 12));
  const descMb = Math.round(clamp(6 * uiScale * density, 4, compact ? 6 : 8));
  const scriptureMb = Math.round(clamp(14 * uiScale * density, 8, compact ? 12 : 16));
  const btnPadV = Math.round(clamp(11 * uiScale * density, 8, compact ? 10 : 13));
  const btnPadH = Math.round(clamp(16 * uiScale * density, 12, compact ? 14 : 18));
  const fsRateChip = Math.round(clamp(11 * uiScale * density, 10, compact ? 11 : 12));
  const rateChipPadH = Math.round(clamp(8 * uiScale * density, 6, compact ? 8 : 10));
  const rateChipPadV = Math.round(clamp(5 * uiScale * density, 4, compact ? 5 : 7));
  const outerPad = Math.round(16 * uiScale * density);
  const cornerRad = Math.round(24 * uiScale * density);
  const cardMb = Math.round(12 * uiScale * density);

  useEffect(() => {
    setAudioProgress(0);
    setAudioPositionMs(0);
    setAudioDurationMs(0);
    setPlaybackRate(1);
  }, [prayer?.id, prayer?.audioUrl]);

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

      <Text
        style={[styles.desc, { color: t.accent, fontSize: fsDesc, lineHeight: lhDesc, marginBottom: descMb }]}
        numberOfLines={compact ? 2 : 3}
      >
        {body}
      </Text>

      {prayer?.scripture && !compact ? (
        <Text style={[styles.scripture, { color: t.accent, fontSize: fsScripture, marginBottom: scriptureMb }]}>
          — {prayer.scripture}
        </Text>
      ) : null}

      <View style={[styles.bottomRow, { gap: rowGap, alignItems: "center", flexWrap: "wrap" }]}>
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
          accessibilityLabel={audioPlaying ? "Pause audio" : "Listen to audio"}
        >
          <Ionicons
            name={audioPlaying ? "pause" : "play"}
            size={playIcn}
            color={t.btnText}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.startBtnText, { color: t.btnText, fontSize: fsStart }]}>
            {audioPlaying ? "Pause" : "Listen"}
          </Text>
        </Pressable>
        {prayer?.audioUrl ? (
          <Pressable
            onPress={() => playRef.current?.cyclePlaybackRate()}
            style={[
              styles.rateChip,
              {
                paddingHorizontal: rateChipPadH,
                paddingVertical: rateChipPadV,
                borderColor: t.accent,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${playbackRate}×`}
          >
            <Text style={[styles.rateChipText, { color: t.accent, fontSize: fsRateChip }]}>{playbackRate}×</Text>
          </Pressable>
        ) : null}
        {prayer?.durationMinutes && !compact && !prayer?.audioUrl ? (
          <Text style={[styles.duration, { color: t.accent, fontSize: fsDuration }]}>{prayer.durationMinutes} min</Text>
        ) : null}
        {compact && prayer?.audioUrl ? (
          (() => {
            const ringPad = 5;
            const strokeW = 3;
            const outer = playCircle + ringPad * 2;
            const cx = outer / 2;
            const cy = outer / 2;
            const r = (outer - strokeW) / 2;
            const circ = 2 * Math.PI * r;
            const p = Math.min(1, Math.max(0, audioProgress));
            return (
              <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
                <Svg
                  width={outer}
                  height={outer}
                  style={{ position: "absolute" }}
                  pointerEvents="none"
                >
                  <G rotation={-90} origin={`${cx}, ${cy}`}>
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      stroke="rgba(0,0,0,0.1)"
                      strokeWidth={strokeW}
                      fill="none"
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      stroke={t.btnBg}
                      strokeWidth={strokeW}
                      fill="none"
                      strokeDasharray={`${circ}, ${circ}`}
                      strokeDashoffset={circ * (1 - p)}
                      strokeLinecap="round"
                    />
                  </G>
                </Svg>
                <OfficialGuidePlayCircle
                  ref={playRef}
                  audioUrl={prayer?.audioUrl}
                  size={playCircle}
                  color={t.btnBg}
                  onPlayingChange={setAudioPlaying}
                  onPlaybackRateChange={setPlaybackRate}
                  onPlaybackProgress={setAudioProgress}
                  onPlaybackTimes={(pos, dur) => {
                    setAudioPositionMs(pos);
                    setAudioDurationMs(dur);
                  }}
                />
              </View>
            );
          })()
        ) : (
          <OfficialGuidePlayCircle
            ref={playRef}
            audioUrl={prayer?.audioUrl}
            size={playCircle}
            color={t.btnBg}
            onPlayingChange={setAudioPlaying}
            onPlaybackRateChange={setPlaybackRate}
            onPlaybackProgress={setAudioProgress}
            onPlaybackTimes={(pos, dur) => {
              setAudioPositionMs(pos);
              setAudioDurationMs(dur);
            }}
          />
        )}
      </View>
      {prayer?.audioUrl && !compact ? (
        <View style={{ marginTop: 6 }}>
          <AudioScrubberRow
            positionMs={audioPositionMs}
            durationMs={audioDurationMs}
            progress01={audioProgress}
            fillColor={t.btnBg}
            onSeek={prayer?.audioUrl ? (p) => playRef.current?.seekProgress(p) : undefined}
          />
        </View>
      ) : null}
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
  rateChip: {
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  rateChipText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  startBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  duration: {
    fontFamily: "PlusJakartaSans_400Regular",
    opacity: 0.6,
  },
});
