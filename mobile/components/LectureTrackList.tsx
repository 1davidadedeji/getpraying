import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import colors from "@/constants/colors";
import type { LectureTrackRow } from "@/lib/officialPrayer";

type Props = {
  tracks: LectureTrackRow[];
  accentColor?: string;
};

/** Playlist UI for multi-part lectures with optional auto-advance between tracks. */
export function LectureTrackList({ tracks, accentColor = colors.primary }: Props) {
  const sorted = useMemo(
    () => [...tracks].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id),
    [tracks],
  );
  const [activeTrackId, setActiveTrackId] = useState<number | null>(sorted[0]?.id ?? null);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoPlayActive, setAutoPlayActive] = useState(false);

  const activeIndex = sorted.findIndex((t) => t.id === activeTrackId);

  const playNext = useCallback(() => {
    if (!autoAdvance || activeIndex < 0 || activeIndex >= sorted.length - 1) return;
    setAutoPlayActive(true);
    setActiveTrackId(sorted[activeIndex + 1]!.id);
  }, [activeIndex, autoAdvance, sorted]);

  useEffect(() => {
    if (!autoPlayActive) return;
    const t = setTimeout(() => setAutoPlayActive(false), 0);
    return () => clearTimeout(t);
  }, [activeTrackId, autoPlayActive]);

  if (sorted.length === 0) {
    return (
      <Text style={styles.empty}>No audio tracks available for this lecture yet.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Playlist</Text>
        <Text style={styles.headerCount}>
          {sorted.length} {sorted.length === 1 ? "track" : "tracks"}
        </Text>
      </View>

      {activeTrackId != null && (
        <View style={styles.nowPlaying}>
          {sorted.map((track) =>
            track.id === activeTrackId ? (
              <View key={track.id}>
                <Text style={styles.nowPlayingLabel}>Now playing</Text>
                <Text style={styles.nowPlayingTitle}>{track.title}</Text>
                {track.description ? (
                  <Text style={styles.nowPlayingDesc}>{track.description}</Text>
                ) : null}
                <CapsuleAudioPlayer
                  audioUrl={track.audioUrl}
                  accentColor={accentColor}
                  onPlaybackFinished={playNext}
                  autoPlay={autoPlayActive}
                />
              </View>
            ) : null,
          )}
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => {
          const isActive = item.id === activeTrackId;
          return (
            <Pressable
              onPress={() => {
                setAutoPlayActive(false);
                setActiveTrackId(item.id);
              }}
              style={({ pressed }) => [
                styles.trackRow,
                isActive && styles.trackRowActive,
                pressed && styles.trackRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.title}`}
            >
              <View style={[styles.indexBadge, isActive && styles.indexBadgeActive]}>
                <Text style={[styles.indexText, isActive && styles.indexTextActive]}>{index + 1}</Text>
              </View>
              <View style={styles.trackBody}>
                <Text style={[styles.trackTitle, isActive && styles.trackTitleActive]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={styles.trackDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={isActive ? "pause-circle" : "play-circle-outline"}
                size={26}
                color={isActive ? accentColor : colors.muted}
              />
            </Pressable>
          );
        }}
      />

      {sorted.length > 1 ? (
        <Pressable
          onPress={() => setAutoAdvance((v) => !v)}
          style={styles.autoAdvanceRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: autoAdvance }}
        >
          <Ionicons
            name={autoAdvance ? "checkbox" : "square-outline"}
            size={18}
            color={autoAdvance ? accentColor : colors.muted}
          />
          <Text style={styles.autoAdvanceText}>Auto-play next track</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: colors.primary,
  },
  headerCount: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  nowPlaying: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  nowPlayingLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  nowPlayingTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  nowPlayingDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  separator: { height: 8 },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackRowActive: {
    borderColor: colors.primary,
    backgroundColor: "#F8F9FC",
  },
  trackRowPressed: { opacity: 0.92 },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeActive: { backgroundColor: colors.primary },
  indexText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.muted,
  },
  indexTextActive: { color: colors.surface },
  trackBody: { flex: 1, gap: 2 },
  trackTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  trackTitleActive: { color: colors.primary },
  trackDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  autoAdvanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  autoAdvanceText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
});
