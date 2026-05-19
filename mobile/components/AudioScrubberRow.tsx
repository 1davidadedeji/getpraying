import React, { useCallback, useRef } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  positionMs: number;
  durationMs: number;
  progress01: number;
  fillColor: string;
  /** @deprecated Labels removed; scrubber is bar-only. */
  timeColor?: string;
  /** @deprecated Labels removed. */
  fontSize?: number;
  trackHeight?: number;
  gap?: number;
  /** When set, tapping the track seeks (native “tap on progress bar” behavior). */
  onSeek?: (progress01: number) => void;
};

/** Slim full-width progress track only (no time labels). */
export function AudioScrubberRow({
  durationMs,
  progress01,
  fillColor,
  trackHeight = 2,
  onSeek,
}: Props) {
  const p = Math.min(1, Math.max(0, progress01));
  const trackWRef = useRef(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWRef.current = e.nativeEvent.layout.width;
  }, []);

  const onTrackPress = useCallback(
    (e: GestureResponderEvent) => {
      if (!onSeek || durationMs <= 0) return;
      const w = trackWRef.current;
      if (w <= 0) return;
      const x = e.nativeEvent.locationX;
      onSeek(Math.min(1, Math.max(0, x / w)));
    },
    [onSeek, durationMs],
  );

  const trackRad = Math.max(1, trackHeight / 2);
  const TrackBody = (
    <View style={[styles.track, { height: trackHeight, borderRadius: trackRad }]} onLayout={onTrackLayout}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(p * 100)}%`,
            backgroundColor: fillColor,
            borderRadius: trackRad,
          },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.row}>
      {onSeek && durationMs > 0 ? (
        <Pressable
          onPress={onTrackPress}
          style={[styles.trackPressable, { minHeight: Math.max(40, trackHeight + 18) }]}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek audio position"
          accessibilityHint="Double tap and use voice control to adjust, or tap along the bar to seek"
        >
          {TrackBody}
        </Pressable>
      ) : (
        <View style={styles.trackSlot}>{TrackBody}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  trackPressable: {
    flex: 1,
    justifyContent: "center",
    minWidth: 32,
  },
  trackSlot: {
    flex: 1,
    minWidth: 32,
    justifyContent: "center",
  },
  track: {
    flex: 1,
    minWidth: 32,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
