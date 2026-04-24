import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { pauseAllMediaExcept, registerMediaController } from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type MediaType = "image" | "video" | "audio" | string | null | undefined;

function AudioAttachment({
  uri,
  compact,
  feedMediaFocused,
}: {
  uri: string;
  compact?: boolean;
  feedMediaFocused?: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [feedAudible, setFeedAudible] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(false);
  const controllerIdRef = useRef<symbol | null>(null);

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
      })();
      return;
    }
    if (!loading && sound) void runFeedAutoplay();
  }, [feedMediaFocused, loading, sound, runFeedAutoplay]);

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
            name={feedSilent ? "volume-mute" : playing ? "pause-circle" : "play-circle"}
            size={compact ? 36 : 44}
            color={colors.primary}
          />
          <Text style={styles.audioLabel}>
            {feedSilent ? "Tap to listen" : playing ? "Pause" : "Play audio"}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function DefaultVideo({
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
      style={[styles.video, !thumbStyle && styles.videoTall, thumbStyle, style]}
      useNativeControls
      resizeMode={ResizeMode.COVER}
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

function FeedVideo({
  uri,
  style,
  thumbStyle,
  feedMediaFocused,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
  feedMediaFocused: boolean;
}) {
  const videoRef = useRef<Video | null>(null);
  const controllerIdRef = useRef<symbol | null>(null);
  const [userUnmuted, setUserUnmuted] = useState(false);

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
    }
  }, [feedMediaFocused]);

  useEffect(() => {
    if (!feedMediaFocused) return;
    const id = controllerIdRef.current;
    if (id == null) return;
    void pauseAllMediaExcept(id);
  }, [feedMediaFocused]);

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

  return (
    <View style={[styles.videoFeedWrap, !thumbStyle && styles.videoTall, thumbStyle, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.videoAbsoluteFill}
        shouldPlay={feedMediaFocused}
        isMuted={!userUnmuted}
        isLooping
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
      />
      <Pressable
        style={styles.muteFab}
        onPress={() => void toggleMute()}
        accessibilityRole="button"
        accessibilityLabel={userUnmuted ? "Mute video" : "Unmute video"}
      >
        <Ionicons
          name={userUnmuted ? "volume-high" : "volume-mute"}
          size={22}
          color={colors.surface}
        />
      </Pressable>
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
}: {
  mediaUrl?: string | null;
  mediaType?: MediaType;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  thumbnail?: boolean;
  /** Home feed: when this post is the focused row, video/audio autoplay muted until user unmutes */
  feedMediaFocused?: boolean;
}) {
  const uri = resolveMediaUrl(mediaUrl);
  if (!uri) return null;

  const thumbStyle = thumbnail ? styles.thumbFixed : undefined;
  const feed = !!feedMediaFocused;

  if (mediaType === "video") {
    return feed ? (
      <FeedVideo
        uri={uri}
        style={style}
        thumbStyle={thumbStyle}
        feedMediaFocused={!!feedMediaFocused}
      />
    ) : (
      <DefaultVideo uri={uri} style={style} thumbStyle={thumbStyle} />
    );
  }

  if (mediaType === "audio") {
    return <AudioAttachment uri={uri} compact={compact} feedMediaFocused={feed} />;
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
  videoFeedWrap: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  videoAbsoluteFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  muteFab: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
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
