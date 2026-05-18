import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export type OfficialGuidePlayHandle = {
  toggle: () => void;
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
};

/** Circular play / pause for official guide audio (library & path sessions). */
export const OfficialGuidePlayCircle = forwardRef<OfficialGuidePlayHandle, Props>(
  function OfficialGuidePlayCircle(
    { audioUrl, size: sizeProp, color = colors.primary, onPlaybackProgress, onPlaybackTimes, onPlayingChange },
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
    const durationHeldRef = useRef(0);

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
        } finally {
          onProgressRef.current?.(0);
          onTimesRef.current?.(0, durationHeldRef.current);
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
        onPlayingChangeRef.current?.(false);
        onProgressRef.current?.(0);
        onTimesRef.current?.(0, 0);
        return;
      }
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

    useImperativeHandle(ref, () => ({ toggle: () => void toggle() }), [uri]);

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
