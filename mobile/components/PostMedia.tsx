import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { clamp } from "@/lib/responsiveMetrics";

type MediaType = "image" | "video" | "audio" | string | null | undefined;

const VIDEO_SKIP_MS = 5000;
const AUDIO_SKIP_MS = 10000;
/** Placeholder aspect before `onReadyForDisplay` — portrait-first matches most prayer clips and avoids 16:9 → 9:16 layout jumps. */
const VIDEO_UNKNOWN_ASPECT = 9 / 16;

function formatTimeMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

function AudioAttachment({
  uri,
  compact,
  feedMediaFocused,
}: {
  uri: string;
  compact?: boolean;
  feedMediaFocused?: boolean;
}) {
  const { uiScale } = useResponsiveLayout();
  const iconCompact = Math.round(clamp(36 * uiScale, 32, 42));
  const iconFull = Math.round(clamp(40 * uiScale, 36, 48));
  const iconSkip = Math.round(clamp(26 * uiScale, 24, 30));
  const audioRad = Math.round(clamp(16 * uiScale, 12, 20));
  const audioRadCompact = Math.round(clamp(12 * uiScale, 10, 16));
  const audioMinH = Math.round(clamp(88 * uiScale, 76, 100));
  const audioMinHCompact = Math.round(clamp(72 * uiScale, 64, 84));
  const audioGap = Math.round(clamp(6 * uiScale, 5, 8));
  const audioPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const labelFs = Math.round(clamp(13 * uiScale, 12, 15));
  const timeFs = Math.round(clamp(12 * uiScale, 11, 13));
  const borderW = Math.max(1, Math.round(uiScale));

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [feedAudible, setFeedAudible] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(false);
  const controllerIdRef = useRef<symbol | null>(null);

  const rich = !compact;

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      const s = soundRef.current;
      if (!s) return;
      try {
        const st = await s.getStatusAsync();
        if (st.isLoaded) {
          await s.pauseAsync();
          await s.setPositionAsync(0);
        }
      } catch {
        /* ignore */
      }
      setPlaying(false);
      setFeedAudible(false);
      setPositionMs(0);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, []);

  // Pause audio whenever the app moves to background to release native resources
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        soundRef.current?.pauseAsync().catch(() => {});
        setPlaying(false);
        setFeedAudible(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    let instance: Audio.Sound | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync({ uri });
        instance = s;
        if (mounted) {
          setSound(s);
          s.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded) {
              if (typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
              if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
                setDurationMs(st.durationMillis);
              }
              if (st.didJustFinish) {
                setPlaying(false);
                setPositionMs(0);
              }
            }
          });
        }
      } catch {
        if (mounted) setSound(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      instance?.unloadAsync().catch(() => {});
    };
  }, [uri]);

  const runFeedAutoplay = useCallback(async () => {
    const s = soundRef.current;
    const cid = controllerIdRef.current;
    if (!s || cid == null || !feedMediaFocused) return;
    await pauseAllMediaExcept(cid);
    try {
      await s.setPositionAsync(0);
      await s.setVolumeAsync(0);
      await s.playAsync();
      setPlaying(true);
      setFeedAudible(false);
    } catch {
      /* ignore */
    }
  }, [feedMediaFocused]);

  useEffect(() => {
    if (!feedMediaFocused) {
      setFeedAudible(false);
      void (async () => {
        const s = soundRef.current;
        if (!s) return;
        try {
          await s.pauseAsync();
          await s.setPositionAsync(0);
        } catch {
          /* ignore */
        }
        setPlaying(false);
        setPositionMs(0);
      })();
      return;
    }
    if (!loading && sound) void runFeedAutoplay();
  }, [feedMediaFocused, loading, sound, runFeedAutoplay]);

  const skipAudio = async (deltaMs: number) => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;
      const pos = st.positionMillis ?? 0;
      const dur = st.durationMillis ?? durationMs;
      const next = Math.max(0, Math.min(dur > 0 ? dur : pos + deltaMs, pos + deltaMs));
      await s.setPositionAsync(next);
    } catch {
      /* ignore */
    }
  };

  const toggle = async () => {
    const s = soundRef.current;
    const cid = controllerIdRef.current;
    if (!s || cid == null) return;
    if (feedMediaFocused) {
      if (!feedAudible) {
        await pauseAllMediaExcept(cid);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        try {
          await s.setVolumeAsync(1);
          // Silent autoplay keeps status as “playing” at volume 0 — always resume so unmute sticks on all platforms.
          await s.playAsync();
          setPlaying(true);
          setFeedAudible(true);
        } catch {
          /* ignore */
        }
      } else {
        try {
          await s.setVolumeAsync(0);
          setFeedAudible(false);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (playingRef.current) {
      await s.pauseAsync();
      setPlaying(false);
    } else {
      await pauseAllMediaExcept(cid);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      try {
        await s.setVolumeAsync(1);
      } catch {
        /* ignore */
      }
      await s.playAsync();
      setPlaying(true);
    }
  };

  const feedSilent = feedMediaFocused && !feedAudible;

  if (rich && !feedMediaFocused) {
    const timeLabel =
      durationMs > 0
        ? `${formatTimeMs(positionMs)} / ${formatTimeMs(durationMs)}`
        : formatTimeMs(positionMs);
    return (
      <View
        style={[
          styles.audioRich,
          {
            borderRadius: audioRad,
            paddingVertical: audioPadV,
            paddingHorizontal: Math.round(12 * uiScale),
            gap: Math.round(8 * uiScale),
            borderWidth: borderW,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={[styles.audioRichRow, { gap: Math.round(10 * uiScale) }]}>
              <Pressable
                onPress={() => void skipAudio(-AUDIO_SKIP_MS)}
                disabled={!sound}
                style={styles.audioIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Back 10 seconds"
              >
                <Ionicons name="play-back" size={iconSkip} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => void toggle()}
                disabled={!sound}
                style={styles.audioIconBtn}
                accessibilityRole="button"
                accessibilityLabel={playing ? "Pause audio" : "Play audio"}
              >
                <Ionicons
                  name={playing ? "pause-circle" : "play-circle"}
                  size={iconFull}
                  color={colors.primary}
                />
              </Pressable>
              <Pressable
                onPress={() => void skipAudio(AUDIO_SKIP_MS)}
                disabled={!sound}
                style={styles.audioIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Forward 10 seconds"
              >
                <Ionicons name="play-forward" size={iconSkip} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={[styles.audioTime, { fontSize: timeFs }]}>{timeLabel}</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      style={[
        styles.audioBox,
        {
          minHeight: compact ? audioMinHCompact : audioMinH,
          borderRadius: compact ? audioRadCompact : audioRad,
          gap: audioGap,
          paddingVertical: audioPadV,
          borderWidth: borderW,
        },
      ]}
      disabled={!sound || loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Ionicons
            name={feedSilent ? "volume-mute" : playing ? "pause-circle" : "play-circle"}
            size={compact ? iconCompact : iconFull}
            color={colors.primary}
          />
          <Text style={[styles.audioLabel, { fontSize: labelFs }]}>
            {feedSilent ? "Tap to listen" : playing ? "Pause" : "Play audio"}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Small preview (e.g. mod queue): native controls, fixed height. */
function ThumbnailVideo({
  uri,
  style,
  thumbStyle,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
}) {
  const videoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      const v = videoRef.current;
      if (!v) return;
      try {
        await v.pauseAsync();
      } catch {
        /* ignore */
      }
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, []);

  return (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={[styles.video, thumbStyle, style]}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      onPlaybackStatusUpdate={(st) => {
        if (!st.isLoaded || !("isPlaying" in st)) return;
        const playing = !!st.isPlaying;
        if (playing && !wasPlayingRef.current) {
          const cid = controllerIdRef.current;
          if (cid != null) void pauseAllMediaExcept(cid);
        }
        wasPlayingRef.current = playing;
      }}
    />
  );
}

/** Post detail: custom chrome aligned with app colors (primary / cream / accent). */
function DetailVideoPlayer({
  uri,
  style,
  thumbStyle,
  layout,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
  layout: "feed" | "detail";
}) {
  const { uiScale } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const videoRef = useRef<Video | null>(null);
  const fullscreenVideoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const wasPlayingRef = useRef(false);
  const hideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsHideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsSeekAppliedRef = useRef(false);
  const fsStartPositionRef = useRef(0);
  const progressW = useRef(1);
  const fsProgressW = useRef(1);
  const videoOpacity = useRef(new Animated.Value(0)).current;

  const [showChrome, setShowChrome] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [fullscreenSession, setFullscreenSession] = useState<{
    positionMs: number;
    shouldPlay: boolean;
  } | null>(null);
  const [fsShowChrome, setFsShowChrome] = useState(true);
  const [fsPlaying, setFsPlaying] = useState(false);
  const [fsPositionMs, setFsPositionMs] = useState(0);
  const [fsDurationMs, setFsDurationMs] = useState(0);

  // Reset opacity + dimensions when the video source changes.
  useEffect(() => {
    videoOpacity.setValue(0);
    setNaturalSize(null);
    setVideoEnded(false);
  }, [uri]);

  const iconCtl = Math.round(clamp(24 * uiScale, 22, 28));
  const iconPlay = Math.round(clamp(36 * uiScale, 32, 42));
  const barPad = Math.round(clamp(12 * uiScale, 10, 14));
  const fsTime = Math.round(clamp(12 * uiScale, 11, 13));
  const centerPlaySz = Math.round(clamp(68 * uiScale, 60, 78));

  // Adapt the container to the video's natural aspect ratio
  const rawAspect = naturalSize != null ? naturalSize.width / naturalSize.height : null;
  const autoAspect = rawAspect != null
    ? Math.max(9 / 16, Math.min(21 / 9, rawAspect))
    : VIDEO_UNKNOWN_ASPECT;
  const sizeStyle = thumbStyle ?? {
    width: "100%" as const,
    aspectRatio: autoAspect,
    ...(layout === "detail" ? { maxHeight: 520 } : {}),
    backgroundColor: "#000",
  };

  const clearHideTimer = () => {
    if (hideChromeTimer.current) {
      clearTimeout(hideChromeTimer.current);
      hideChromeTimer.current = null;
    }
  };

  const scheduleHideChrome = () => {
    clearHideTimer();
    hideChromeTimer.current = setTimeout(() => setShowChrome(false), 3200);
  };

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      const v = videoRef.current;
      if (!v) return;
      try {
        await v.pauseAsync();
      } catch {
        /* ignore */
      }
      setPlaying(false);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
      clearHideTimer();
      if (fsHideChromeTimer.current) {
        clearTimeout(fsHideChromeTimer.current);
        fsHideChromeTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        videoRef.current?.pauseAsync().catch(() => {});
        setPlaying(false);
        clearHideTimer();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    fsSeekAppliedRef.current = false;
    if (!fullscreenSession) {
      setFsShowChrome(true);
      setFsPlaying(false);
      setFsPositionMs(0);
      setFsDurationMs(0);
    }
  }, [fullscreenSession]);

  useEffect(() => {
    if (!fullscreenSession) return;
    if (Platform.OS !== "android") return;
    RNStatusBar.setHidden(true, "fade");
    return () => {
      RNStatusBar.setHidden(false, "fade");
    };
  }, [fullscreenSession]);

  const clearFsHideTimer = () => {
    if (fsHideChromeTimer.current) {
      clearTimeout(fsHideChromeTimer.current);
      fsHideChromeTimer.current = null;
    }
  };

  const scheduleFsHideChrome = () => {
    clearFsHideTimer();
    fsHideChromeTimer.current = setTimeout(() => setFsShowChrome(false), 3200);
  };

  const onPlaybackStatusUpdate = (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    if (typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
    if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
      setDurationMs(st.durationMillis);
    }
    if ("didJustFinish" in st && st.didJustFinish) {
      setVideoEnded(true);
      setPlaying(false);
      wasPlayingRef.current = false;
      // Keep chrome visible so the play button is accessible for replay
      clearHideTimer();
      setShowChrome(true);
      return;
    }
    if ("isPlaying" in st) {
      const p = !!st.isPlaying;
      setPlaying(p);
      if (p && !wasPlayingRef.current) {
        const cid = controllerIdRef.current;
        if (cid != null) void pauseAllMediaExcept(cid);
      }
      wasPlayingRef.current = p;
      if (p) scheduleHideChrome();
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) {
        await v.pauseAsync();
      } else {
        const cid = controllerIdRef.current;
        if (cid != null) await pauseAllMediaExcept(cid);
        if (videoEnded) {
          await v.setPositionAsync(0);
          setVideoEnded(false);
          setPositionMs(0);
        }
        await v.playAsync();
      }
      setShowChrome(true);
      scheduleHideChrome();
    } catch {
      /* ignore */
    }
  };

  const skipBy = async (deltaMs: number) => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded || typeof st.positionMillis !== "number") return;
      const dur = typeof st.durationMillis === "number" ? st.durationMillis : durationMs;
      const next = Math.max(0, Math.min(dur > 0 ? dur - 250 : st.positionMillis + deltaMs, st.positionMillis + deltaMs));
      await v.setPositionAsync(next);
      setShowChrome(true);
      scheduleHideChrome();
    } catch {
      /* ignore */
    }
  };

  const seekFromProgressPress = async (x: number) => {
    const v = videoRef.current;
    const w = progressW.current;
    if (!v || w < 8 || durationMs <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    try {
      await v.setPositionAsync(Math.floor(ratio * durationMs));
      setShowChrome(true);
      scheduleHideChrome();
    } catch {
      /* ignore */
    }
  };

  const closeInlineFullscreen = async () => {
    const fsV = fullscreenVideoRef.current;
    const main = videoRef.current;
    let endPos = fsPositionMs;
    let fsWasPlaying = fsPlaying;
    try {
      if (fsV) {
        const st = await fsV.getStatusAsync();
        if (st.isLoaded) {
          if (typeof st.positionMillis === "number") endPos = st.positionMillis;
          fsWasPlaying = "isPlaying" in st && !!st.isPlaying;
        }
        await fsV.pauseAsync();
      }
    } catch {
      /* ignore */
    }
    clearFsHideTimer();
    setFullscreenSession(null);
    try {
      if (main) {
        await main.setPositionAsync(endPos);
        if (fsWasPlaying) await main.playAsync();
      }
    } catch {
      /* ignore */
    }
  };

  const openFullscreen = async () => {
    const v = videoRef.current;
    if (!v || fullscreenSession) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded) return;
      const positionMs = typeof st.positionMillis === "number" ? st.positionMillis : 0;
      const shouldPlay = "isPlaying" in st && !!st.isPlaying;
      await v.pauseAsync();
      fsStartPositionRef.current = positionMs;
      setFsPositionMs(positionMs);
      setFsDurationMs(typeof st.durationMillis === "number" ? st.durationMillis : durationMs);
      setFsPlaying(shouldPlay);
      setFsShowChrome(true);
      setFullscreenSession({ positionMs, shouldPlay });
    } catch {
      /* ignore */
    }
  };

  const onFsPlaybackStatusUpdate = async (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    const start = fsStartPositionRef.current;
    if (
      !fsSeekAppliedRef.current &&
      start > 0 &&
      typeof st.positionMillis === "number" &&
      st.positionMillis < 80
    ) {
      fsSeekAppliedRef.current = true;
      try {
        await fullscreenVideoRef.current?.setPositionAsync(start);
      } catch {
        /* ignore */
      }
    }
    if (typeof st.positionMillis === "number") setFsPositionMs(st.positionMillis);
    if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
      setFsDurationMs(st.durationMillis);
    }
    if ("didJustFinish" in st && st.didJustFinish) {
      setFsPlaying(false);
    }
    if ("isPlaying" in st) {
      const p = !!st.isPlaying;
      setFsPlaying(p);
      if (p) scheduleFsHideChrome();
    }
  };

  const fsTogglePlay = async () => {
    const v = fullscreenVideoRef.current;
    if (!v) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) await v.pauseAsync();
      else {
        const cid = controllerIdRef.current;
        if (cid != null) await pauseAllMediaExcept(cid);
        const dur =
          typeof st.durationMillis === "number" && st.durationMillis > 0
            ? st.durationMillis
            : fsDurationMs;
        const pos = typeof st.positionMillis === "number" ? st.positionMillis : fsPositionMs;
        const nearEnd = dur > 0 && pos >= dur - 500;
        if (nearEnd) {
          await v.setPositionAsync(0);
          setFsPositionMs(0);
        }
        await v.playAsync();
      }
      setFsShowChrome(true);
      scheduleFsHideChrome();
    } catch {
      /* ignore */
    }
  };

  const fsSkipBy = async (deltaMs: number) => {
    const v = fullscreenVideoRef.current;
    if (!v) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded || typeof st.positionMillis !== "number") return;
      const dur = typeof st.durationMillis === "number" ? st.durationMillis : fsDurationMs;
      const next = Math.max(0, Math.min(dur > 0 ? dur - 250 : st.positionMillis + deltaMs, st.positionMillis + deltaMs));
      await v.setPositionAsync(next);
      setFsShowChrome(true);
      scheduleFsHideChrome();
    } catch {
      /* ignore */
    }
  };

  const fsSeekFromProgressPress = async (x: number) => {
    const v = fullscreenVideoRef.current;
    const w = fsProgressW.current;
    if (!v || w < 8 || fsDurationMs <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    try {
      await v.setPositionAsync(Math.floor(ratio * fsDurationMs));
      setFsShowChrome(true);
      scheduleFsHideChrome();
    } catch {
      /* ignore */
    }
  };

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const fsProgress = fsDurationMs > 0 ? Math.min(1, fsPositionMs / fsDurationMs) : 0;

  const revealChrome = () => {
    setShowChrome(true);
    scheduleHideChrome();
  };

  const hideChrome = () => {
    clearHideTimer();
    setShowChrome(false);
  };

  const revealFsChrome = () => {
    setFsShowChrome(true);
    scheduleFsHideChrome();
  };

  const hideFsChrome = () => {
    clearFsHideTimer();
    setFsShowChrome(false);
  };

  return (
    <>
    <View style={[styles.detailVideoShell, sizeStyle, style]}>
      {/* Cream placeholder visible while video metadata loads */}
      <View style={[StyleSheet.absoluteFillObject, styles.videoPlaceholder]} />
      {/* Video fades in at its correct aspect ratio — no snap */}
      <Animated.View style={[styles.videoAbsoluteFill, { opacity: videoOpacity }]}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onReadyForDisplay={(event: any) => {
            if (event?.naturalSize) {
              setNaturalSize({ width: event.naturalSize.width, height: event.naturalSize.height });
            }
            Animated.timing(videoOpacity, {
              toValue: 1,
              duration: 240,
              useNativeDriver: true,
            }).start();
          }}
        />
      </Animated.View>
      {/* Single tap layer — toggles chrome show/hide; controls above intercept their own presses */}
      <Pressable
        style={[styles.detailTapLayer]}
        onPress={showChrome ? hideChrome : revealChrome}
        accessibilityRole="button"
        accessibilityLabel={showChrome ? "Hide video controls" : "Show video controls"}
      />
      {showChrome ? (
        <>
          <View style={styles.detailDim} pointerEvents="none" />
          {/* Center play/pause button */}
          <View style={[styles.detailCenterPlayWrap, { pointerEvents: "box-none" }]}>
            <Pressable
              onPress={() => void togglePlay()}
              style={[styles.detailCenterPlayBtn, { width: centerPlaySz, height: centerPlaySz, borderRadius: centerPlaySz / 2 }]}
              accessibilityRole="button"
              accessibilityLabel={playing ? "Pause" : "Play"}
            >
              <Ionicons
                name={playing ? "pause" : "play"}
                size={iconPlay}
                color={colors.surface}
              />
            </Pressable>
          </View>
          {/* Bottom control bar */}
          <View style={[styles.detailBottomBar, { padding: barPad }]}>
            {/* Skip + fullscreen row — play/pause is handled exclusively by the center button above */}
            <View style={styles.detailBtnRow}>
              <Pressable
                onPress={() => void skipBy(-VIDEO_SKIP_MS)}
                style={styles.detailIconHit}
                accessibilityRole="button"
                accessibilityLabel="Back 5 seconds"
              >
                <Ionicons name="play-back" size={iconCtl} color={colors.surface} />
              </Pressable>
              <Pressable
                onPress={() => void skipBy(VIDEO_SKIP_MS)}
                style={styles.detailIconHit}
                accessibilityRole="button"
                accessibilityLabel="Forward 5 seconds"
              >
                <Ionicons name="play-forward" size={iconCtl} color={colors.surface} />
              </Pressable>
              <Pressable
                onPress={() => void openFullscreen()}
                style={styles.detailIconHit}
                accessibilityRole="button"
                accessibilityLabel="Fullscreen"
              >
                <Ionicons name="expand-outline" size={iconCtl} color={colors.surface} />
              </Pressable>
            </View>
            {/* Time below controls */}
            <Text style={[styles.detailTime, { fontSize: fsTime }]}>
              {formatTimeMs(positionMs)} · {formatTimeMs(durationMs)}
            </Text>
            {/* Seek progress bar */}
            <Pressable
              onLayout={(e: LayoutChangeEvent) => {
                progressW.current = e.nativeEvent.layout.width;
              }}
              style={styles.detailProgressTrack}
              onPress={(e) => {
                void seekFromProgressPress(e.nativeEvent.locationX);
              }}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek"
            >
              <View style={[styles.detailProgressFill, { width: `${progress * 100}%` }]} />
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
    <Modal
      visible={fullscreenSession != null}
      animationType="fade"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
      onRequestClose={() => void closeInlineFullscreen()}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={[styles.fullscreenModalRoot, { width: winW, height: winH }]}>
        {fullscreenSession ? (
          <>
            <Video
              ref={fullscreenVideoRef}
              source={{ uri }}
              style={styles.fullscreenVideo}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={fullscreenSession.shouldPlay}
              onPlaybackStatusUpdate={onFsPlaybackStatusUpdate}
            />
            <Pressable
              style={styles.fullscreenTapLayer}
              onPress={fsShowChrome ? hideFsChrome : revealFsChrome}
              accessibilityRole="button"
              accessibilityLabel={fsShowChrome ? "Hide video controls" : "Show video controls"}
            />
            <Pressable
              onPress={() => void closeInlineFullscreen()}
              style={[
                styles.fullscreenCloseBtn,
                {
                  top: insets.top + 8,
                  left: insets.left + 10,
                  padding: 10,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Exit fullscreen"
            >
              <Ionicons name="close" size={iconCtl + 4} color={colors.surface} />
            </Pressable>
            {fsShowChrome ? (
              <>
                <View style={styles.detailDim} pointerEvents="none" />
                <View style={[styles.detailCenterPlayWrap, { pointerEvents: "box-none" }]}>
                  <Pressable
                    onPress={() => void fsTogglePlay()}
                    style={[
                      styles.detailCenterPlayBtn,
                      { width: centerPlaySz, height: centerPlaySz, borderRadius: centerPlaySz / 2 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={fsPlaying ? "Pause" : "Play"}
                  >
                    <Ionicons
                      name={fsPlaying ? "pause" : "play"}
                      size={iconPlay}
                      color={colors.surface}
                    />
                  </Pressable>
                </View>
                <View style={[styles.fullscreenBottomBar, { padding: barPad, paddingBottom: barPad + insets.bottom }]}>
                  <View style={styles.detailBtnRow}>
                    <Pressable
                      onPress={() => void fsSkipBy(-VIDEO_SKIP_MS)}
                      style={styles.detailIconHit}
                      accessibilityRole="button"
                      accessibilityLabel="Back 5 seconds"
                    >
                      <Ionicons name="play-back" size={iconCtl} color={colors.surface} />
                    </Pressable>
                    <Pressable
                      onPress={() => void fsSkipBy(VIDEO_SKIP_MS)}
                      style={styles.detailIconHit}
                      accessibilityRole="button"
                      accessibilityLabel="Forward 5 seconds"
                    >
                      <Ionicons name="play-forward" size={iconCtl} color={colors.surface} />
                    </Pressable>
                  </View>
                  <Text style={[styles.detailTime, { fontSize: fsTime }]}>
                    {formatTimeMs(fsPositionMs)} · {formatTimeMs(fsDurationMs)}
                  </Text>
                  <Pressable
                    onLayout={(e: LayoutChangeEvent) => {
                      fsProgressW.current = e.nativeEvent.layout.width;
                    }}
                    style={styles.detailProgressTrack}
                    onPress={(e) => {
                      void fsSeekFromProgressPress(e.nativeEvent.locationX);
                    }}
                    accessibilityRole="adjustable"
                    accessibilityLabel="Seek"
                  >
                    <View style={[styles.detailProgressFill, { width: `${fsProgress * 100}%` }]} />
                  </Pressable>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
    </>
  );
}

function FeedVideo({
  uri,
  style,
  thumbStyle,
  feedMediaFocused,
  onOpenDetail,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
  feedMediaFocused: boolean;
  onOpenDetail?: () => void;
}) {
  const { uiScale } = useResponsiveLayout();
  const muteFabSize = Math.round(clamp(40 * uiScale, 36, 46));
  const muteIcon = Math.round(clamp(22 * uiScale, 20, 26));
  const muteBottom = Math.round(clamp(10 * uiScale, 8, 12));
  const muteRight = Math.round(clamp(10 * uiScale, 8, 12));
  const feedRad = Math.round(clamp(16 * uiScale, 12, 20));
  const barH = Math.round(clamp(44 * uiScale, 40, 50));
  const barIcon = Math.round(clamp(22 * uiScale, 20, 26));
  const fsBar = Math.round(clamp(11 * uiScale, 10, 12));
  const centerPlaySz = Math.round(clamp(56 * uiScale, 48, 64));

  const videoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const videoOpacity = useRef(new Animated.Value(0)).current;
  const [userUnmuted, setUserUnmuted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hasPlaybackEnded, setHasPlaybackEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Reset opacity + dimensions whenever the video source changes.
  useEffect(() => {
    videoOpacity.setValue(0);
    setNaturalSize(null);
    setHasPlaybackEnded(false);
  }, [uri]);

  // Compute adaptive aspect ratio from detected video dimensions
  const rawAspect = naturalSize != null ? naturalSize.width / naturalSize.height : null;
  const containerAspect = rawAspect != null
    ? (rawAspect < 1 ? Math.max(9 / 16, rawAspect) : Math.min(16 / 9, rawAspect))
    : null;
  const videoResizeMode = rawAspect != null && rawAspect < 1 ? ResizeMode.CONTAIN : ResizeMode.COVER;

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      const v = videoRef.current;
      if (v) {
        try {
          await v.pauseAsync();
          await v.setPositionAsync(0);
        } catch {
          /* ignore */
        }
      }
      setUserUnmuted(false);
      setUserPaused(false);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setUserPaused(true);
        setUserUnmuted(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!feedMediaFocused) {
      setUserUnmuted(false);
      setUserPaused(false);
      setHasPlaybackEnded(false);
    }
  }, [feedMediaFocused]);

  useEffect(() => {
    if (!feedMediaFocused) return;
    const id = controllerIdRef.current;
    if (id == null) return;
    void pauseAllMediaExcept(id);
  }, [feedMediaFocused]);

  const shouldPlay = feedMediaFocused && !userPaused;

  const toggleMute = async () => {
    const id = controllerIdRef.current;
    if (id == null) return;
    if (!userUnmuted) {
      await pauseAllMediaExcept(id);
      // Do NOT set playsInSilentModeIOS here — video audio should respect the ringer switch.
      // Only AudioAttachment (podcast-style) overrides silent mode.
      setUserUnmuted(true);
    } else {
      setUserUnmuted(false);
    }
  };

  const replayFromStart = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.setPositionAsync(0);
      setPositionMs(0);
      setHasPlaybackEnded(false);
      setUserPaused(false);
    } catch {
      /* ignore */
    }
  };

  const handlePlayPause = () => {
    if (hasPlaybackEnded) {
      void replayFromStart();
      return;
    }
    setUserPaused((p) => !p);
  };

  const onPressBarPlay = () => {
    if (hasPlaybackEnded) {
      void replayFromStart();
      return;
    }
    setUserPaused((p) => !p);
  };

  const onStatus = (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    if (typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
    if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
      setDurationMs(st.durationMillis);
    }
    if ("didJustFinish" in st && st.didJustFinish) {
      setUserPaused(true);
      setHasPlaybackEnded(true);
      const v = videoRef.current;
      const dur = typeof st.durationMillis === "number" ? st.durationMillis : durationMs;
      if (v && dur > 120) {
        void v.setPositionAsync(Math.max(0, dur - 80)).catch(() => {});
      }
      if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
        setPositionMs(st.durationMillis);
      }
    }
  };

  const showCenterPlay = feedMediaFocused && userPaused;

  return (
    <View
      style={[
        styles.videoFeedWrap,
        !thumbStyle && {
          aspectRatio: containerAspect ?? VIDEO_UNKNOWN_ASPECT,
        },
        { borderRadius: feedRad },
        thumbStyle,
        style,
      ]}
    >
      {/* Cream placeholder visible while video metadata loads */}
      <View style={[StyleSheet.absoluteFillObject, styles.videoPlaceholder, { borderRadius: feedRad }]} />
      {/* Video fades in at its correct aspect ratio — no snap */}
      <Animated.View style={[styles.videoAbsoluteFill, { borderRadius: feedRad, opacity: videoOpacity }]}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          shouldPlay={shouldPlay}
          isMuted={!userUnmuted}
          isLooping={false}
          useNativeControls={false}
          resizeMode={videoResizeMode}
          onPlaybackStatusUpdate={onStatus}
          onReadyForDisplay={(event: any) => {
            if (event?.naturalSize) {
              setNaturalSize({ width: event.naturalSize.width, height: event.naturalSize.height });
            }
            Animated.timing(videoOpacity, {
              toValue: 1,
              duration: 240,
              useNativeDriver: true,
            }).start();
          }}
        />
      </Animated.View>
      {feedMediaFocused ? (
        <>
          {showCenterPlay ? (
            <Pressable
              style={[styles.feedCenterPlay, { borderRadius: feedRad }]}
              onPress={handlePlayPause}
              accessibilityRole="button"
              accessibilityLabel="Play video"
            >
              <Ionicons
                name="play-circle"
                size={centerPlaySz}
                color="rgba(249,246,240,0.92)"
              />
            </Pressable>
          ) : null}
          <View
            style={[
              styles.feedBottomChrome,
              { height: barH, borderBottomLeftRadius: feedRad, borderBottomRightRadius: feedRad },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={onPressBarPlay}
              style={styles.feedBarBtn}
              accessibilityRole="button"
              accessibilityLabel={hasPlaybackEnded ? "Replay video" : userPaused ? "Play" : "Pause"}
            >
              <Ionicons
                name={hasPlaybackEnded ? "play" : userPaused ? "play" : "pause"}
                size={barIcon}
                color={colors.surface}
              />
            </Pressable>
            <Text style={[styles.feedBarTime, { fontSize: fsBar }]} numberOfLines={1}>
              {formatTimeMs(positionMs)} / {formatTimeMs(durationMs)}
            </Text>
            {onOpenDetail && !hasPlaybackEnded ? (
              <Pressable
                onPress={onOpenDetail}
                style={styles.feedBarBtn}
                accessibilityRole="button"
                accessibilityLabel="Open full prayer"
              >
                <Ionicons name="open-outline" size={barIcon} color={colors.surface} />
              </Pressable>
            ) : (
              <View style={{ width: barIcon + 16 }} />
            )}
          </View>
          <Pressable
            style={[
              styles.muteFab,
              {
                bottom: muteBottom + barH - 6,
                right: muteRight,
                width: muteFabSize,
                height: muteFabSize,
                borderRadius: muteFabSize / 2,
              },
            ]}
            onPress={() => void toggleMute()}
            accessibilityRole="button"
            accessibilityLabel={userUnmuted ? "Mute video" : "Unmute video"}
          >
            <Ionicons
              name={userUnmuted ? "volume-high" : "volume-mute"}
              size={muteIcon}
              color={colors.surface}
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

export function PostMediaBlock({
  mediaUrl,
  mediaType,
  style,
  compact,
  thumbnail,
  feedMediaFocused,
  onOpenPostDetail,
  mediaLayout = "feed",
}: {
  mediaUrl?: string | null;
  mediaType?: MediaType;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  thumbnail?: boolean;
  feedMediaFocused?: boolean;
  onOpenPostDetail?: () => void;
  mediaLayout?: "feed" | "detail";
}) {
  const uri = resolveMediaUrl(mediaUrl);
  const { uiScale } = useResponsiveLayout();
  const mediaRad = Math.round(clamp(16 * uiScale, 12, 22));
  const thumbH = Math.round(clamp(100 * uiScale, 88, 120));
  const radiusStyle = { borderRadius: mediaRad };
  const thumbStyle = thumbnail ? { height: thumbH } : undefined;

  if (!uri) return null;

  const feed = !!feedMediaFocused;

  if (mediaType === "video") {
    return feed ? (
      <FeedVideo
        uri={uri}
        style={[radiusStyle, style]}
        thumbStyle={thumbStyle}
        feedMediaFocused={!!feedMediaFocused}
        onOpenDetail={onOpenPostDetail}
      />
    ) : thumbnail ? (
      <ThumbnailVideo uri={uri} style={[radiusStyle, style]} thumbStyle={thumbStyle} />
    ) : (
      <DetailVideoPlayer
        uri={uri}
        style={[radiusStyle, style]}
        thumbStyle={thumbStyle}
        layout={mediaLayout === "detail" ? "detail" : "feed"}
      />
    );
  }

  if (mediaType === "audio") {
    return <AudioAttachment uri={uri} compact={compact} feedMediaFocused={feed} />;
  }

  const imageStyles = [
    styles.image,
    radiusStyle,
    !thumbnail && styles.imageTall,
    thumbStyle,
    style,
  ].filter(Boolean) as StyleProp<ImageStyle>[];

  return (
    <Image
      source={{ uri }}
      style={imageStyles}
      contentFit="cover"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    backgroundColor: colors.cream,
  },
  imageTall: {
    aspectRatio: 16 / 10,
  },
  video: {
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 16,
  },
  videoDetailBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 480,
    backgroundColor: "#000",
  },
  detailVideoShell: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  fullscreenModalRoot: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  fullscreenVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  fullscreenTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  fullscreenCloseBtn: {
    position: "absolute",
    zIndex: 6,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "rgba(16,20,40,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(249,246,240,0.12)",
  },
  detailTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  detailDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,31,54,0.18)",
  },
  detailCenterPlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCenterPlayBtn: {
    backgroundColor: "rgba(26,31,54,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "rgba(16,20,40,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(249,246,240,0.12)",
  },
  detailTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  detailTime: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(249,246,240,0.7)",
    marginBottom: 6,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  detailBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    marginBottom: 4,
  },
  detailIconHit: {
    padding: 10,
    minWidth: 44,
    alignItems: "center",
  },
  detailProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(249,246,240,0.2)",
    overflow: "hidden",
    marginTop: 4,
  },
  detailProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  videoFeedWrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  videoAbsoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlaceholder: {
    backgroundColor: colors.surface,
    zIndex: 0,
  },
  feedCenterPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  feedBottomChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    backgroundColor: "rgba(26,31,36,0.88)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(249,246,240,0.15)",
    zIndex: 3,
  },
  feedBarBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: "center",
  },
  feedBarTime: {
    flex: 1,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.cream,
    marginHorizontal: 6,
  },
  muteFab: {
    position: "absolute",
    zIndex: 4,
    backgroundColor: "rgba(26,31,54,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  audioBox: {
    width: "100%",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  audioRich: {
    width: "100%",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  audioRichRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  audioIconBtn: {
    padding: 4,
    minWidth: 44,
    alignItems: "center",
  },
  audioTime: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.muted,
  },
  audioLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
});
