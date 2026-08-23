import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import colors from "@/constants/colors";
import { prefetchCachedAudio } from "@/lib/audioMediaCache";
import type { LectureTrackRow } from "@/lib/officialPrayer";
import { premiumCardStyle } from "@/lib/premiumPostTheme";
import { PremiumGatedContent } from "@/components/PremiumGatedContent";

type Props = {
  tracks: LectureTrackRow[];
  accentColor?: string;
  isPremiumLocked?: boolean;
  guideIsPremium?: boolean;
};

/** Each track in a lecture series is its own card with inline playback when selected. */
export function LectureTrackList({
  tracks,
  accentColor = colors.primary,
  isPremiumLocked = false,
  guideIsPremium = false,
}: Props) {
  const sorted = useMemo(
    () => [...tracks].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id),
    [tracks],
  );
  const [activeTrackId, setActiveTrackId] = useState<number | null>(sorted[0]?.id ?? null);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoPlayActive, setAutoPlayActive] = useState(false);

  useEffect(() => {
    setActiveTrackId(sorted[0]?.id ?? null);
    setAutoPlayActive(false);
  }, [sorted]);

  useEffect(() => {
    if (isPremiumLocked) return;
    for (const track of sorted) {
      prefetchCachedAudio(track.audioUrl);
    }
  }, [sorted, isPremiumLocked]);

  const trackPlayable = (track: LectureTrackRow) =>
    !isPremiumLocked && Boolean(track.audioUrl?.trim());

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
      <View style={styles.emptyCard}>
        <Ionicons name="musical-notes-outline" size={28} color={colors.muted} />
        <Text style={styles.emptyTitle}>Audio coming soon</Text>
        <Text style={styles.emptyText}>
          This lesson does not have any audio parts yet. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.seriesHeader}>
        <Text style={styles.seriesTitle}>In this series</Text>
        <Text style={styles.seriesCount}>
          {sorted.length} {sorted.length === 1 ? "part" : "parts"}
        </Text>
      </View>

      <View style={styles.cardStack}>
        {sorted.map((track, index) => {
          const isActive = track.id === activeTrackId;
          return (
            <Pressable
              key={track.id}
              onPress={() => {
                if (!trackPlayable(track)) return;
                if (isActive) return;
                setAutoPlayActive(true);
                setActiveTrackId(track.id);
              }}
              style={({ pressed }) => [
                styles.trackCard,
                guideIsPremium && premiumCardStyle(true),
                isActive && styles.trackCardActive,
                !isActive && pressed && styles.trackCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${isActive ? "Playing" : "Play"} part ${index + 1}: ${track.title}`}
            >
              <View style={styles.trackCardTop}>
                <View style={[styles.indexBadge, isActive && styles.indexBadgeActive]}>
                  <Text style={[styles.indexText, isActive && styles.indexTextActive]}>{index + 1}</Text>
                </View>
                <View style={styles.trackCopy}>
                  <Text style={[styles.trackTitle, isActive && styles.trackTitleActive]} numberOfLines={2}>
                    {track.title}
                  </Text>
                </View>
                {!isActive && !isPremiumLocked ? (
                  <View style={styles.playFab}>
                    <Ionicons name="play" size={18} color={accentColor} />
                  </View>
                ) : null}
              </View>

              <PremiumGatedContent
                locked={isPremiumLocked}
                isPremium={guideIsPremium}
                mode="media"
                overlaySize={isActive ? "default" : "compact"}
                minHeight={isActive ? 100 : 72}
                onUnlocked={() => {
                  setAutoPlayActive(true);
                  setActiveTrackId(track.id);
                }}
              >
                <>
                  {track.description ? (
                    <FormattedBodyText
                      text={track.description}
                      style={styles.trackDesc}
                      fontSize={13}
                      numberOfLines={isActive ? undefined : 2}
                    />
                  ) : null}

                  {isActive ? (
                    <View style={styles.playerWrap}>
                      {trackPlayable(track) ? (
                        <CapsuleAudioPlayer
                          audioUrl={track.audioUrl}
                          accentColor={accentColor}
                          onPlaybackFinished={playNext}
                          autoPlay={autoPlayActive}
                        />
                      ) : (
                        <View style={styles.audioPlaceholder} accessibilityLabel="Premium audio locked" />
                      )}
                    </View>
                  ) : null}
                </>
              </PremiumGatedContent>
            </Pressable>
          );
        })}
      </View>

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
          <Text style={styles.autoAdvanceText}>Auto-play next part</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  seriesHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  seriesTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
  },
  seriesCount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cardStack: { gap: 10 },
  trackCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  trackCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#F8FAFC",
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  trackCardPressed: { opacity: 0.92 },
  trackCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeActive: { backgroundColor: colors.primary },
  indexText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.muted,
  },
  indexTextActive: { color: colors.surface },
  trackCopy: { flex: 1, gap: 4 },
  trackTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 15,
    color: colors.primary,
  },
  trackTitleActive: { color: colors.primary },
  trackDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  playFab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  playerWrap: { marginTop: 2 },
  audioPlaceholder: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.cream,
  },
  autoAdvanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  autoAdvanceText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  emptyText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
});
