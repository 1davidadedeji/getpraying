import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import colors from "@/constants/colors";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type MediaType = "image" | "video" | "audio" | string | null | undefined;

function AudioAttachment({ uri, compact }: { uri: string; compact?: boolean }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

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
      instance?.unloadAsync().catch(() => {});
    };
  }, [uri]);

  const toggle = async () => {
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playAsync();
      setPlaying(true);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.audioBox, compact && styles.audioBoxCompact]}
      disabled={!sound || loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Ionicons
            name={playing ? "pause-circle" : "play-circle"}
            size={compact ? 36 : 44}
            color={colors.primary}
          />
          <Text style={styles.audioLabel}>{playing ? "Pause" : "Play audio"}</Text>
        </>
      )}
    </Pressable>
  );
}

export function PostMediaBlock({
  mediaUrl,
  mediaType,
  style,
  compact,
  thumbnail,
}: {
  mediaUrl?: string | null;
  mediaType?: MediaType;
  style?: StyleProp<ViewStyle>;
  /** Shorter audio row for moderation cards */
  compact?: boolean;
  /** Fixed-height preview (e.g. moderation queue) */
  thumbnail?: boolean;
}) {
  const uri = resolveMediaUrl(mediaUrl);
  if (!uri) return null;

  const thumbStyle = thumbnail ? styles.thumbFixed : undefined;

  if (mediaType === "video") {
    return (
      <Video
        source={{ uri }}
        style={[styles.video, !thumbnail && styles.videoTall, thumbStyle, style]}
        useNativeControls
        resizeMode={ResizeMode.COVER}
      />
    );
  }

  if (mediaType === "audio") {
    return <AudioAttachment uri={uri} compact={compact} />;
  }

  const imageStyles = [
    styles.image,
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
    borderRadius: 16,
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
  thumbFixed: {
    height: 100,
  },
  audioBox: {
    width: "100%",
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  audioBoxCompact: {
    minHeight: 72,
    borderRadius: 12,
  },
  audioLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
});
