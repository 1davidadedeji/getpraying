import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatTimeMs } from "@/lib/formatTimeMs";
import { clamp } from "@/lib/responsiveMetrics";

export type CapsuleMediaControlsProps = {
  loading?: boolean;
  playing: boolean;
  feedSilent?: boolean;
  positionMs: number;
  durationMs: number;
  muted: boolean;
  accentColor?: string;
  backgroundColor?: string;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (progress01: number) => void;
  trailing?: React.ReactNode;
  disabled?: boolean;
};

/** Shared pill controls: play/pause, time, seek bar, volume. */
export function CapsuleMediaControls({
  loading = false,
  playing,
  feedSilent = false,
  positionMs,
  durationMs,
  muted,
  accentColor = colors.textSecondary,
  backgroundColor = "#F1F3F4",
  onTogglePlay,
  onToggleMute,
  onSeek,
  trailing,
  disabled = false,
}: CapsuleMediaControlsProps) {
  const { uiScale } = useResponsiveLayout();
  const iconPlay = Math.round(clamp(14 * uiScale, 12, 16));
  const iconVol = Math.round(clamp(18 * uiScale, 16, 20));
  const fsTime = Math.round(clamp(12 * uiScale, 11, 13));
  const trackH = Math.max(2, Math.round(2 * uiScale));
  const pillPadV = Math.round(clamp(8 * uiScale, 6, 10));
  const pillPadH = Math.round(clamp(10 * uiScale, 8, 12));
  const gap = Math.round(clamp(8 * uiScale, 6, 10));
  const trackWRef = useRef(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWRef.current = e.nativeEvent.layout.width;
  }, []);

  const onTrackPress = useCallback(
    (e: GestureResponderEvent) => {
      if (durationMs <= 0) return;
      const w = trackWRef.current;
      if (w <= 0) return;
      const x = e.nativeEvent.locationX;
      onSeek(Math.min(1, Math.max(0, x / w)));
    },
    [durationMs, onSeek],
  );

  const progress01 = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  const timeLabel =
    durationMs > 0
      ? `${formatTimeMs(positionMs)} / ${formatTimeMs(durationMs)}`
      : `${formatTimeMs(positionMs)} / 0:00`;
  const showMuted = feedSilent || muted;
  const trackRad = Math.max(1, trackH / 2);
  const controlsDisabled = disabled;
  const seekDisabled = disabled || durationMs <= 0;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor,
          paddingVertical: pillPadV,
          paddingHorizontal: pillPadH,
          gap,
        },
      ]}
    >
      <Pressable
        onPress={onTogglePlay}
        disabled={controlsDisabled}
        style={styles.iconHit}
        accessibilityRole="button"
        accessibilityLabel={playing && !feedSilent ? "Pause" : feedSilent ? "Tap to listen" : "Play"}
      >
        {loading ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Ionicons
            name={playing && !feedSilent ? "pause" : "play"}
            size={iconPlay}
            color={accentColor}
          />
        )}
      </Pressable>

      <Text style={[styles.time, { fontSize: fsTime, color: accentColor }]} numberOfLines={1}>
        {timeLabel}
      </Text>

      <Pressable
        onPress={onTrackPress}
        onLayout={onTrackLayout}
        style={styles.trackPressable}
        disabled={seekDisabled}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek position"
      >
        <View style={[styles.track, { height: trackH, borderRadius: trackRad }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress01 * 100)}%`,
                backgroundColor: accentColor,
                borderRadius: trackRad,
              },
            ]}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={onToggleMute}
        disabled={controlsDisabled}
        style={styles.iconHit}
        accessibilityRole="button"
        accessibilityLabel={showMuted ? "Unmute" : "Mute"}
      >
        <Ionicons
          name={showMuted ? "volume-mute" : "volume-medium"}
          size={iconVol}
          color={accentColor}
        />
      </Pressable>

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderRadius: 999,
  },
  iconHit: {
    minWidth: 28,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  trackPressable: {
    flex: 1,
    justifyContent: "center",
    minWidth: 40,
    minHeight: 28,
  },
  track: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
