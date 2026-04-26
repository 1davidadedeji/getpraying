import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { clamp } from "@/lib/responsiveMetrics";

type MediaType = "image" | "video" | "audio" | string | null | undefined;

const VIDEO_SKIP_MS = 5000;
const AUDIO_SKIP_MS = 10000;

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
          if (!playingRef.current) await s.playAsync();
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
  const videoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const wasPlayingRef = useRef(false);
  const hideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressW = useRef(1);

  const [showChrome, setShowChrome] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const iconCtl = Math.round(clamp(22 * uiScale, 20, 26));
  const iconPlay = Math.round(clamp(28 * uiScale, 26, 34));
  const barPad = Math.round(clamp(10 * uiScale, 8, 12));
  const fsTime = Math.round(clamp(12 * uiScale, 11, 13));
  const sizeStyle =
    thumbStyle ?? (layout === "detail" ? styles.videoDetailBox : styles.videoTall);

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
    };
  }, []);

  const onPlaybackStatusUpdate = (st: AVPlaybackStatus) => {
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
      if (p) scheduleHideChrome();
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const st = await v.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) await v.pauseAsync();
      else {
        const cid = controllerIdRef.current;
        if (cid != null) await pauseAllMediaExcept(cid);
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

  const openFullscreen = async () => {
    const v = videoRef.current as Video & {
      presentFullscreenPlayer?: () => Promise<void>;
      presentFullscreenPlayerAsync?: () => Promise<void>;
    };
    if (!v) return;
    try {
      if (typeof v.presentFullscreenPlayerAsync === "function") {
        await v.presentFullscreenPlayerAsync();
      } else if (typeof v.presentFullscreenPlayer === "function") {
        await v.presentFullscreenPlayer();
      }
    } catch {
      /* Web or unsupported */
    }
  };

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  const revealChrome = () => {
    setShowChrome(true);
    scheduleHideChrome();
  };

  const hideChrome = () => {
    clearHideTimer();
    setShowChrome(false);
  };

  return (
    <View style={[styles.detailVideoShell, sizeStyle, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={[styles.videoAbsoluteFill]}
        useNativeControls={false}
        resizeMode={layout === "detail" ? ResizeMode.CONTAIN : ResizeMode.COVER}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
      {!showChrome ? (
        <Pressable
          style={styles.detailTapLayer}
          onPress={revealChrome}
          accessibilityRole="button"
          accessibilityLabel="Show video controls"
        />
      ) : null}
      {showChrome ? (
        <>
          <View style={styles.detailDim} pointerEvents="none" />
          <View style={[styles.detailCenterPlayWrap, { pointerEvents: "box-none" }]}>
            <Pressable
              onPress={() => void togglePlay()}
              style={styles.detailCenterPlayBtn}
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
          <View style={[styles.detailBottomBar, { padding: barPad }]}>
            <View style={styles.detailTimeRow}>
              <Pressable
                onPress={hideChrome}
                style={styles.detailIconHit}
                accessibilityRole="button"
                accessibilityLabel="Hide controls"
              >
                <Ionicons name="chevron-down" size={iconCtl} color={colors.cream} />
              </Pressable>
              <Text style={[styles.detailTime, { fontSize: fsTime, flex: 1, marginBottom: 0 }]}>
                {formatTimeMs(positionMs)} · {formatTimeMs(durationMs)}
              </Text>
            </View>
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
                onPress={() => void togglePlay()}
                style={styles.detailIconHit}
                accessibilityRole="button"
                accessibilityLabel={playing ? "Pause" : "Play"}
              >
                <Ionicons name={playing ? "pause" : "play"} size={iconCtl} color={colors.surface} />
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
  const [userUnmuted, setUserUnmuted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

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
    if (!feedMediaFocused) {
      setUserUnmuted(false);
      setUserPaused(false);
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
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      setUserUnmuted(true);
    } else {
      setUserUnmuted(false);
    }
  };

  const togglePause = () => setUserPaused((p) => !p);

  const onStatus = (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    if (typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
    if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
      setDurationMs(st.durationMillis);
    }
  };

  const showCenterPlay = feedMediaFocused && userPaused;

  return (
    <View style={[styles.videoFeedWrap, !thumbStyle && styles.videoTall, { borderRadius: feedRad }, thumbStyle, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={[styles.videoAbsoluteFill, { borderRadius: feedRad }]}
        shouldPlay={shouldPlay}
        isMuted={!userUnmuted}
        isLooping
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
        onPlaybackStatusUpdate={onStatus}
      />
      {feedMediaFocused ? (
        <>
          {showCenterPlay ? (
            <Pressable
              style={[styles.feedCenterPlay, { borderRadius: feedRad }]}
              onPress={togglePause}
              accessibilityRole="button"
              accessibilityLabel="Play video"
            >
              <Ionicons name="play-circle" size={centerPlaySz} color="rgba(249,246,240,0.92)" />
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
              onPress={togglePause}
              style={styles.feedBarBtn}
              accessibilityRole="button"
              accessibilityLabel={userPaused ? "Play" : "Pause"}
            >
              <Ionicons
                name={userPaused ? "play" : "pause"}
                size={barIcon}
                color={colors.surface}
              />
            </Pressable>
            <Text style={[styles.feedBarTime, { fontSize: fsBar }]} numberOfLines={1}>
              {formatTimeMs(positionMs)} / {formatTimeMs(durationMs)}
            </Text>
            {onOpenDetail ? (
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
  videoTall: {
    aspectRatio: 16 / 10,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  detailBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "rgba(26,31,36,0.88)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(249,246,240,0.2)",
  },
  detailTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  detailTime: {
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.cream,
    marginBottom: 6,
  },
  detailBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  detailIconHit: {
    padding: 8,
    minWidth: 40,
    alignItems: "center",
  },
  detailProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(249,246,240,0.25)",
    overflow: "hidden",
  },
  detailProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 2,
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
