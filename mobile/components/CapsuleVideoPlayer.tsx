import { Ionicons } from "@expo/vector-icons";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import colors from "@/constants/colors";
import { CapsuleMediaControls } from "@/components/CapsuleMediaControls";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { clamp } from "@/lib/responsiveMetrics";

const VIDEO_UNKNOWN_ASPECT = 9 / 16;

type Props = {
  videoUrl: string | null | undefined;
  accentColor?: string;
  backgroundColor?: string;
  feedMediaFocused?: boolean;
  onOpenDetail?: () => void;
  maxHeight?: number;
  fixedHeight?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Video viewport + capsule controls matching the audio player. */
export function CapsuleVideoPlayer({
  videoUrl,
  accentColor = colors.primary,
  backgroundColor = "#F1F3F4",
  feedMediaFocused = false,
  onOpenDetail,
  maxHeight,
  fixedHeight,
  borderRadius,
  style,
}: Props) {
  const { uiScale } = useResponsiveLayout();
  const uri = resolveMediaUrl(videoUrl ?? null);
  const cornerRad = borderRadius ?? Math.round(clamp(16 * uiScale, 12, 20));
  const openIcn = Math.round(clamp(18 * uiScale, 16, 20));

  // expo-video: player owns the media session. The setup callback runs once on
  // creation (synchronous) — it must not read props that change over time.
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = false;
    p.muted = true; // always start muted; audio is enabled imperatively below
  });

  const videoOpacity = useRef(new Animated.Value(0)).current;
  const controllerIdRef = useRef<symbol | null>(null);
  const wasPlayingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(feedMediaFocused);
  const [feedAudible, setFeedAudible] = useState(false);
  const [ended, setEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // Keep player.muted in sync with our derived isMuted value.
  const isMuted = feedMediaFocused ? !feedAudible : muted;
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // Reset all state whenever the video source changes.
  useEffect(() => {
    videoOpacity.setValue(0);
    setReady(false);
    setPlaying(false);
    setMuted(feedMediaFocused);
    setFeedAudible(false);
    setEnded(false);
    setPositionMs(0);
    setDurationMs(0);
  }, [uri, videoOpacity, feedMediaFocused]);

  // ── Status change: fade in when ready, capture video dimensions ─────────────
  // useEventListener is a hook form of player.addListener — safe inside render.
  useEventListener(player, "statusChange", ({ status }) => {
    if (status !== "readyToPlay") return;
    const dur = Math.round(player.duration * 1000);
    if (dur > 0) setDurationMs(dur);
    setReady(true);
    Animated.timing(videoOpacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  });

  // ── Playing state: keep React state in sync with the native player ──────────
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  useEffect(() => {
    setPlaying(isPlaying);
    if (isPlaying && !wasPlayingRef.current) {
      const cid = controllerIdRef.current;
      if (cid != null) void pauseAllMediaExcept(cid);
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ── End of playback ─────────────────────────────────────────────────────────
  useEventListener(player, "playToEnd", () => {
    setPlaying(false);
    setEnded(true);
    wasPlayingRef.current = false;
    // Park just before the end so the last frame stays visible.
    const parkAt = Math.max(0, player.duration - 0.08);
    player.currentTime = parkAt;
    setPositionMs(Math.round(parkAt * 1000));
    if (durationMs > 0) setPositionMs(durationMs);
  });

  // ── Position polling while playing (250 ms = smooth scrubber) ───────────────
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const ms = Math.round(player.currentTime * 1000);
      setPositionMs(ms);
      // Keep durationMs up to date in case it resolved after readyToPlay.
      const dur = Math.round(player.duration * 1000);
      if (dur > 0 && dur !== durationMs) setDurationMs(dur);
    }, 250);
    return () => clearInterval(id);
  }, [playing, player, durationMs]);

  // ── Coordinator: let other media pause this player ───────────────────────────
  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      player.pause();
      if (feedMediaFocused) player.currentTime = 0;
      setPlaying(false);
      setFeedAudible(false);
      setMuted(true);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, [feedMediaFocused, player]);

  // ── App background: always pause ────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        player.pause();
        setPlaying(false);
        setFeedAudible(false);
        setMuted(true);
      }
    });
    return () => sub.remove();
  }, [player]);

  // ── Feed focus: auto-play muted when cell enters view ───────────────────────
  useEffect(() => {
    if (!feedMediaFocused) {
      setFeedAudible(false);
      setMuted(false);
      setPlaying(false);
      setEnded(false);
      player.pause();
      player.currentTime = 0;
      setPositionMs(0);
      return;
    }
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void pauseAllMediaExcept(cid);
    // Start muted autoplay — player.muted is already synced via the isMuted effect.
    player.play();
    setPlaying(true);
    setMuted(true);
    setFeedAudible(false);
    setEnded(false);
  }, [feedMediaFocused, player]);

  // ────────────────────────────────────────────────────────────────────────────

  const replayFromStart = useCallback(async () => {
    player.currentTime = 0;
    setPositionMs(0);
    setEnded(false);
    player.play();
    setPlaying(true);
  }, [player]);

  const togglePlay = useCallback(async () => {
    const cid = controllerIdRef.current;
    if (cid == null) return;

    if (ended) {
      void replayFromStart();
      return;
    }

    // Feed cell first tap → unmute rather than pause.
    if (feedMediaFocused && !feedAudible) {
      await pauseAllMediaExcept(cid);
      setMuted(false);
      setFeedAudible(true);
      player.play();
      setPlaying(true);
      return;
    }

    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      await pauseAllMediaExcept(cid);
      player.play();
      setPlaying(true);
    }
  }, [ended, feedMediaFocused, feedAudible, playing, player, replayFromStart]);

  const toggleMute = useCallback(() => {
    if (feedMediaFocused && !feedAudible) {
      void togglePlay();
      return;
    }
    setMuted((m) => !m);
    if (feedMediaFocused) setFeedAudible((a) => !a);
  }, [feedMediaFocused, feedAudible, togglePlay]);

  const seekProgress = useCallback(
    (progress01: number) => {
      if (durationMs <= 0) return;
      const secs = (Math.min(1, Math.max(0, progress01)) * durationMs) / 1000;
      player.currentTime = secs;
      setPositionMs(Math.round(secs * 1000));
      setEnded(false);
    },
    [durationMs, player],
  );

  if (!uri) return null;

  const containerAspect = fixedHeight ? undefined : VIDEO_UNKNOWN_ASPECT;
  const contentFit: "contain" | "cover" = "cover";

  const feedSilent = feedMediaFocused && !feedAudible;

  const trailing =
    feedMediaFocused && onOpenDetail && !ended ? (
      <Pressable
        onPress={onOpenDetail}
        style={styles.iconHit}
        accessibilityRole="button"
        accessibilityLabel="Open full prayer"
      >
        <Ionicons name="open-outline" size={openIcn} color={accentColor} />
      </Pressable>
    ) : null;

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.videoShell,
          {
            borderRadius: cornerRad,
            aspectRatio: containerAspect,
            height: fixedHeight,
            maxHeight: maxHeight,
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder, { borderRadius: cornerRad }]} />
        <Animated.View style={[styles.videoFill, { borderRadius: cornerRad, opacity: videoOpacity }]}>
          {/*
            VideoView renders the player's output. All playback control happens
            via the `player` object — no `shouldPlay` / `isMuted` props needed.
            nativeControls={false} keeps our custom CapsuleMediaControls in charge.
          */}
          <VideoView
            player={player}
            style={StyleSheet.absoluteFillObject}
            contentFit={contentFit}
            nativeControls={false}
            allowsFullscreen={false}
          />
        </Animated.View>
      </View>
      <View style={styles.controlsGap}>
        <CapsuleMediaControls
          loading={!ready}
          playing={playing}
          feedSilent={feedSilent}
          positionMs={positionMs}
          durationMs={durationMs}
          muted={muted}
          accentColor={accentColor}
          backgroundColor={backgroundColor}
          onTogglePlay={() => void togglePlay()}
          onToggleMute={toggleMute}
          onSeek={seekProgress}
          trailing={trailing}
          disabled={!ready}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  videoShell: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  placeholder: {
    backgroundColor: colors.surface,
  },
  videoFill: {
    ...StyleSheet.absoluteFillObject,
  },
  controlsGap: {
    marginTop: 8,
  },
  iconHit: {
    minWidth: 28,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
