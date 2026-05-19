import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const RATE_OPTIONS = [1, 1.25, 1.5, 2] as const;

export type OfficialGuidePlayHandle = {
  toggle: () => void;
  seekProgress: (progress01: number) => void;
  cyclePlaybackRate: () => void;
  getPlaybackRate: () => number;
};

type Props = {
  audioUrl: string | null | undefined;
  /** Defaults to a scale-aware size when omitted */
  size?: number;
  color?: string;
  /** 0..1 while playing; 0 when idle or unknown */
  onPlaybackProgress?: (progress01: number) => void;
  /** Milliseconds; duration may be 0 until loaded */
  onPlaybackTimes?: (positionMillis: number, durationMillis: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlaybackRateChange?: (rate: number) => void;
};

/** Circular play / pause for official guide audio (library & path sessions). */
export const OfficialGuidePlayCircle = forwardRef<OfficialGuidePlayHandle, Props>(
  function OfficialGuidePlayCircle(
    {
      audioUrl,
      size: sizeProp,
      color = colors.primary,
      onPlaybackProgress,
      onPlaybackTimes,
      onPlayingChange,
      onPlaybackRateChange,
    },
    ref,
  ) {
    const { uiScale } = useResponsiveLayout();
    const defaultSize = Math.round(clamp(52 * uiScale, 44, 60));
    const size = sizeProp ?? defaultSize;

    const uri = resolveMediaUrl(audioUrl ?? null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [loading, setLoading] = useState(!!uri);
    const [playing, setPlaying] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);
    const playingRef = useRef(false);
    const controllerIdRef = useRef<symbol | null>(null);
    const onProgressRef = useRef(onPlaybackProgress);
    onProgressRef.current = onPlaybackProgress;
    const onPlayingChangeRef = useRef(onPlayingChange);
    onPlayingChangeRef.current = onPlayingChange;
    const onTimesRef = useRef(onPlaybackTimes);
    onTimesRef.current = onPlaybackTimes;
    const onRateRef = useRef(onPlaybackRateChange);
    onRateRef.current = onPlaybackRateChange;
    const durationHeldRef = useRef(0);
    const rateIndexRef = useRef(0);

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
          if (st.isLoaded && st.isPlaying) {
            await s.pauseAsync();
          }
          if (st.isLoaded && typeof st.positionMillis === "number" && typeof st.durationMillis === "number") {
            durationHeldRef.current = st.durationMillis > 0 ? st.durationMillis : durationHeldRef.current;
            onTimesRef.current?.(st.positionMillis, st.durationMillis || durationHeldRef.current);
            const dur = st.durationMillis || durationHeldRef.current;
            onProgressRef.current?.(dur > 0 ? Math.min(1, st.positionMillis / dur) : 0);
          }
        } catch {
          /* ignore */
        } finally {
          setPlaying(false);
          onPlayingChangeRef.current?.(false);
        }
      });
      controllerIdRef.current = id;
      return () => {
        unregister();
        controllerIdRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!uri) {
        setSound(null);
        setLoading(false);
        setPlaying(false);
        durationHeldRef.current = 0;
        rateIndexRef.current = 0;
        onPlayingChangeRef.current?.(false);
        onProgressRef.current?.(0);
        onTimesRef.current?.(0, 0);
        return;
      }
      let mounted = true;
      rateIndexRef.current = 0;
      let instance: Audio.Sound | null = null;
      (async () => {
        try {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound: s } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, isLooping: false, positionMillis: 0 },
          );
          instance = s;
          if (mounted) {
            setSound(s);
            const startRate = RATE_OPTIONS[rateIndexRef.current];
            try {
              await s.setRateAsync(startRate, true);
            } catch {
              /* platform may ignore */
            }
            onRateRef.current?.(startRate);
            s.setOnPlaybackStatusUpdate((st) => {
              if (st.isLoaded) {
                if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
                  durationHeldRef.current = st.durationMillis;
                }
                if (typeof st.isPlaying === "boolean") {
                  setPlaying(st.isPlaying);
                  onPlayingChangeRef.current?.(st.isPlaying);
                }
                if (st.didJustFinish) {
                  setPlaying(false);
                  onPlayingChangeRef.current?.(false);
                  onProgressRef.current?.(0);
                  onTimesRef.current?.(0, durationHeldRef.current);
                  void (async () => {
                    try {
                      await s.setPositionAsync(0);
                      await s.pauseAsync();
                    } catch {
                      /* ignore */
                    }
                  })();
                  return;
                }
              }
              if (
                st.isLoaded &&
                typeof st.durationMillis === "number" &&
                st.durationMillis > 0 &&
                typeof st.positionMillis === "number"
              ) {
                onProgressRef.current?.(Math.min(1, st.positionMillis / st.durationMillis));
                onTimesRef.current?.(st.positionMillis, st.durationMillis);
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

    const applyRate = async (s: Audio.Sound, idx: number) => {
      const r = RATE_OPTIONS[Math.max(0, Math.min(RATE_OPTIONS.length - 1, idx))];
      try {
        await s.setRateAsync(r, true);
      } catch {
        /* ignore */
      }
      onRateRef.current?.(r);
    };

    const toggle = async () => {
      if (!uri) return;
      const s = soundRef.current;
      const cid = controllerIdRef.current;
      if (!s || cid == null) return;
      if (playingRef.current) {
        await s.pauseAsync();
        setPlaying(false);
        onPlayingChangeRef.current?.(false);
      } else {
        await pauseAllMediaExcept(cid);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        await s.playAsync();
        setPlaying(true);
        onPlayingChangeRef.current?.(true);
      }
    };

    const seekProgress = async (progress01: number) => {
      const s = soundRef.current;
      if (!s) return;
      const p = Math.min(1, Math.max(0, progress01));
      try {
        const st = await s.getStatusAsync();
        if (!st.isLoaded || typeof st.durationMillis !== "number" || st.durationMillis <= 0) return;
        const ms = Math.round(p * st.durationMillis);
        await s.setPositionAsync(ms);
        onProgressRef.current?.(p);
        onTimesRef.current?.(ms, st.durationMillis);
      } catch {
        /* ignore */
      }
    };

    const cyclePlaybackRate = async () => {
      const s = soundRef.current;
      if (!s) return;
      rateIndexRef.current = (rateIndexRef.current + 1) % RATE_OPTIONS.length;
      await applyRate(s, rateIndexRef.current);
    };

    useImperativeHandle(
      ref,
      () => ({
        toggle: () => void toggle(),
        seekProgress: (p: number) => void seekProgress(p),
        cyclePlaybackRate: () => void cyclePlaybackRate(),
        getPlaybackRate: () => RATE_OPTIONS[rateIndexRef.current],
      }),
      [uri],
    );

    if (!uri) {
      return (
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, opacity: 0.35 }]}>
          <Ionicons name="musical-notes-outline" size={size * 0.4} color={color} />
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => void toggle()}
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
        ]}
        disabled={!sound || loading}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause audio" : "Play audio"}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <Ionicons name={playing ? "pause" : "play"} size={size * 0.38} color={color} />
        )}
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
});
