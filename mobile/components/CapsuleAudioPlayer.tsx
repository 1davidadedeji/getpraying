import { Audio } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import colors from "@/constants/colors";
import { CapsuleMediaControls } from "@/components/CapsuleMediaControls";
import {
  acquireCachedSound,
  pauseAllMediaExcept,
  registerMediaController,
} from "@/lib/mediaPlaybackCoordinator";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Props = {
  audioUrl: string | null | undefined;
  accentColor?: string;
  backgroundColor?: string;
  feedMediaFocused?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Called when playback reaches the end (not looped). */
  onPlaybackFinished?: () => void;
  /** Start playback once the file is loaded. */
  autoPlay?: boolean;
};

const POSITION_UI_INTERVAL_MS = 250;

/** Minimal pill audio player: play/pause, time, seek bar, volume. */
export function CapsuleAudioPlayer({
  audioUrl,
  accentColor = colors.textSecondary,
  backgroundColor = "#F1F3F4",
  feedMediaFocused = false,
  onPlayingChange,
  onPlaybackFinished,
  autoPlay = false,
}: Props) {
  const uri = resolveMediaUrl(audioUrl ?? null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(!!uri);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [feedAudible, setFeedAudible] = useState(false);
  const [ended, setEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(false);
  const controllerIdRef = useRef<symbol | null>(null);
  const durationHeldRef = useRef(0);
  const releaseSoundRef = useRef<(() => void) | null>(null);
  const lastPositionUiAtRef = useRef(0);
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const onPlaybackFinishedRef = useRef(onPlaybackFinished);
  onPlaybackFinishedRef.current = onPlaybackFinished;

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
        if (st.isLoaded && st.isPlaying) await s.pauseAsync();
        if (st.isLoaded && typeof st.positionMillis === "number") setPositionMs(st.positionMillis);
      } catch {
        /* ignore */
      } finally {
        setPlaying(false);
        setFeedAudible(false);
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
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        soundRef.current?.pauseAsync().catch(() => {});
        setPlaying(false);
        setFeedAudible(false);
        onPlayingChangeRef.current?.(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!uri) {
      releaseSoundRef.current?.();
      releaseSoundRef.current = null;
      setSound(null);
      setLoading(false);
      setPlaying(false);
      setMuted(false);
      setFeedAudible(false);
      setEnded(false);
      setPositionMs(0);
      setDurationMs(0);
      durationHeldRef.current = 0;
      onPlayingChangeRef.current?.(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const cached = await acquireCachedSound(uri);
        if (!mounted) {
          cached.release();
          return;
        }
        releaseSoundRef.current?.();
        releaseSoundRef.current = cached.release;
        setSound(cached.sound);
        durationHeldRef.current = cached.durationMs;
        setDurationMs(cached.durationMs);

        cached.sound.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
            durationHeldRef.current = st.durationMillis;
            setDurationMs(st.durationMillis);
          }
          if (typeof st.positionMillis === "number") {
            const now = Date.now();
            if (
              now - lastPositionUiAtRef.current >= POSITION_UI_INTERVAL_MS ||
              st.didJustFinish ||
              st.isPlaying !== playingRef.current
            ) {
              lastPositionUiAtRef.current = now;
              setPositionMs(st.positionMillis);
            }
          }
          if (typeof st.isPlaying === "boolean") {
            setPlaying(st.isPlaying);
            onPlayingChangeRef.current?.(st.isPlaying);
          }
          if (st.didJustFinish) {
            setPlaying(false);
            setEnded(true);
            onPlayingChangeRef.current?.(false);
            setPositionMs(0);
            onPlaybackFinishedRef.current?.();
            void (async () => {
              try {
                await cached.sound.setPositionAsync(0);
                await cached.sound.pauseAsync();
              } catch {
                /* ignore */
              }
            })();
          }
        });

        const st = await cached.sound.getStatusAsync();
        if (mounted && st.isLoaded && typeof st.positionMillis === "number") {
          setPositionMs(st.positionMillis);
        }
      } catch {
        if (mounted) setSound(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      releaseSoundRef.current?.();
      releaseSoundRef.current = null;
    };
  }, [uri]);

  useEffect(() => {
    if (!autoPlay || loading || !sound) return;
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void (async () => {
      await pauseAllMediaExcept(cid);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        await sound.setVolumeAsync(1);
        await sound.setPositionAsync(0);
        await sound.playAsync();
        setPlaying(true);
        setMuted(false);
        setEnded(false);
        onPlayingChangeRef.current?.(true);
      } catch {
        /* ignore */
      }
    })();
  }, [autoPlay, loading, sound]);

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
      setMuted(true);
      setFeedAudible(false);
      setEnded(false);
      onPlayingChangeRef.current?.(true);
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
        } catch {
          /* ignore */
        }
        setPlaying(false);
        setMuted(false);
        onPlayingChangeRef.current?.(false);
      })();
      return;
    }
    if (!loading && sound) void runFeedAutoplay();
  }, [feedMediaFocused, loading, sound, runFeedAutoplay]);

  const togglePlay = async () => {
    const s = soundRef.current;
    const cid = controllerIdRef.current;
    if (!s || cid == null) return;

    if (feedMediaFocused && !feedAudible) {
      await pauseAllMediaExcept(cid);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      try {
        await s.setVolumeAsync(1);
        if (ended) {
          await s.setPositionAsync(0);
          setEnded(false);
          setPositionMs(0);
        }
        await s.playAsync();
        setPlaying(true);
        setMuted(false);
        setFeedAudible(true);
        onPlayingChangeRef.current?.(true);
      } catch {
        /* ignore */
      }
      return;
    }

    if (playingRef.current) {
      await s.pauseAsync();
      setPlaying(false);
      onPlayingChangeRef.current?.(false);
    } else {
      await pauseAllMediaExcept(cid);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      try {
        if (ended) {
          await s.setPositionAsync(0);
          setEnded(false);
          setPositionMs(0);
        }
        if (!muted) await s.setVolumeAsync(1);
        await s.playAsync();
        setPlaying(true);
        onPlayingChangeRef.current?.(true);
      } catch {
        /* ignore */
      }
    }
  };

  const toggleMute = async () => {
    const s = soundRef.current;
    if (!s) return;
    if (feedMediaFocused) {
      if (!feedAudible) {
        void togglePlay();
        return;
      }
      try {
        await s.setVolumeAsync(0);
        setMuted(true);
        setFeedAudible(false);
      } catch {
        /* ignore */
      }
      return;
    }
    const nextMuted = !muted;
    try {
      await s.setVolumeAsync(nextMuted ? 0 : 1);
      setMuted(nextMuted);
    } catch {
      /* ignore */
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
      setPositionMs(ms);
      setEnded(false);
    } catch {
      /* ignore */
    }
  };

  if (!uri) return null;

  const feedSilent = feedMediaFocused && !feedAudible;

  return (
    <CapsuleMediaControls
      loading={loading}
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
      disabled={!sound}
    />
  );
}
