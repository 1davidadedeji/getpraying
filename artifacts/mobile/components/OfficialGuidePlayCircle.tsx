import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import colors from "@/constants/colors";
import { registerOfficialGuideSound, pauseOtherOfficialGuides } from "@/lib/officialGuidesAudioSession";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export type OfficialGuidePlayHandle = {
  toggle: () => void;
};

type Props = {
  audioUrl: string | null | undefined;
  size?: number;
  color?: string;
};

/** Circular play / pause for official guide audio (library & path sessions). */
export const OfficialGuidePlayCircle = forwardRef<OfficialGuidePlayHandle, Props>(function OfficialGuidePlayCircle(
  { audioUrl, size = 52, color = colors.primary },
  ref,
) {
  const uri = resolveMediaUrl(audioUrl ?? null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(!!uri);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!uri) {
      setSound(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    let instance: Audio.Sound | null = null;
    let unregister: (() => void) | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync({ uri });
        instance = s;
        unregister = registerOfficialGuideSound(s);
        if (mounted) {
          setSound(s);
          s.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && st.didJustFinish) setPlaying(false);
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
      unregister?.();
      instance?.unloadAsync().catch(() => {});
    };
  }, [uri]);

  const toggle = async () => {
    if (!uri) return;
    const s = soundRef.current;
    if (!s) return;
    if (playingRef.current) {
      await s.pauseAsync();
      setPlaying(false);
    } else {
      await pauseOtherOfficialGuides(s);
      await s.playAsync();
      setPlaying(true);
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
});

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
});
