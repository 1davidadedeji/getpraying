import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
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

/** Video viewport + capsule controls matching audio player. */
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

  const videoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const videoOpacity = useRef(new Animated.Value(0)).current;
  const wasPlayingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(feedMediaFocused);
  const [feedAudible, setFeedAudible] = useState(false);
  const [ended, setEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    videoOpacity.setValue(0);
    setReady(false);
    setNaturalSize(null);
    setPlaying(false);
    setMuted(feedMediaFocused);
    setFeedAudible(false);
    setEnded(false);
    setPositionMs(0);
    setDurationMs(0);
  }, [uri, videoOpacity]);

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      const v = videoRef.current;
      if (v) {
        try {
          await v.pauseAsync();
          if (feedMediaFocused) await v.setPositionAsync(0);
        } catch {
          /* ignore */
        }
      }
      setPlaying(false);
      setFeedAudible(false);
      setMuted(true);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, [feedMediaFocused]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        videoRef.current?.pauseAsync().catch(() => {});
        setPlaying(false);
        setFeedAudible(false);
        setMuted(true);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!feedMediaFocused) {
      setFeedAudible(false);
      setMuted(false);
      setPlaying(false);
      setEnded(false);
      void (async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
          await v.pauseAsync();
          await v.setPositionAsync(0);
        } catch {
          /* ignore */
        }
        setPositionMs(0);
      })();
      return;
    }
    const id = controllerIdRef.current;
    if (id == null) return;
    void pauseAllMediaExcept(id);
    setPlaying(true);
    setMuted(true);
    setFeedAudible(false);
    setEnded(false);
  }, [feedMediaFocused]);

  const onStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    if (typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
    if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
      setDurationMs(st.durationMillis);
    }
    if ("isPlaying" in st) {
      const p = !!st.isPlaying;
      setPlaying(p);
      if (p && !wasPlayingRef.current) {
        const cid = controllerIdRef.current;
        if (cid != null) void pauseAllMediaExcept(cid);
      }
      wasPlayingRef.current = p;
    }
    if ("didJustFinish" in st && st.didJustFinish) {
      setPlaying(false);
      setEnded(true);
      wasPlayingRef.current = false;
      const v = videoRef.current;
      const dur = typeof st.durationMillis === "number" ? st.durationMillis : durationMs;
      if (v && dur > 120) {
        void v.setPositionAsync(Math.max(0, dur - 80)).catch(() => {});
      }
      if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
        setPositionMs(st.durationMillis);
      }
    }
  }, [durationMs]);

  const replayFromStart = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.setPositionAsync(0);
      setPositionMs(0);
      setEnded(false);
      setPlaying(true);
      await v.playAsync();
    } catch {
      /* ignore */
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    const cid = controllerIdRef.current;
    if (!v || cid == null) return;

    if (ended) {
      void replayFromStart();
      return;
    }

    if (feedMediaFocused && !feedAudible) {
      await pauseAllMediaExcept(cid);
      setMuted(false);
      setFeedAudible(true);
      setPlaying(true);
      try {
        await v.playAsync();
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) {
        await v.pauseAsync();
        setPlaying(false);
      } else {
        await pauseAllMediaExcept(cid);
        await v.playAsync();
        setPlaying(true);
      }
    } catch {
      /* ignore */
    }
  };

  const toggleMute = async () => {
    if (feedMediaFocused && !feedAudible) {
      void togglePlay();
      return;
    }
    setMuted((m) => !m);
    if (feedMediaFocused) setFeedAudible((a) => !a);
  };

  const seekProgress = async (progress01: number) => {
    const v = videoRef.current;
    if (!v || durationMs <= 0) return;
    const ms = Math.round(Math.min(1, Math.max(0, progress01)) * durationMs);
    try {
      await v.setPositionAsync(ms);
      setPositionMs(ms);
      setEnded(false);
    } catch {
      /* ignore */
    }
  };

  if (!uri) return null;

  const rawAspect = naturalSize != null ? naturalSize.width / naturalSize.height : null;
  const containerAspect = fixedHeight
    ? undefined
    : rawAspect != null
      ? rawAspect < 1
        ? Math.max(9 / 16, rawAspect)
        : Math.min(16 / 9, rawAspect)
      : VIDEO_UNKNOWN_ASPECT;
  const videoResizeMode =
    rawAspect != null && rawAspect < 1 ? ResizeMode.CONTAIN : ResizeMode.COVER;
  const feedSilent = feedMediaFocused && !feedAudible;
  const shouldPlay = feedMediaFocused ? playing && !ended : playing;
  const isMuted = feedMediaFocused ? !feedAudible : muted;

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
          <Video
            ref={videoRef}
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            shouldPlay={shouldPlay}
            isMuted={isMuted}
            isLooping={false}
            useNativeControls={false}
            resizeMode={videoResizeMode}
            onPlaybackStatusUpdate={onStatus}
            onReadyForDisplay={(event: { naturalSize?: { width: number; height: number } }) => {
              if (event?.naturalSize) {
                setNaturalSize({ width: event.naturalSize.width, height: event.naturalSize.height });
              }
              setReady(true);
              Animated.timing(videoOpacity, {
                toValue: 1,
                duration: 240,
                useNativeDriver: true,
              }).start();
            }}
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
          onToggleMute={() => void toggleMute()}
          onSeek={(p) => void seekProgress(p)}
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
