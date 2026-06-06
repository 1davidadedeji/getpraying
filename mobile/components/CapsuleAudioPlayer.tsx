import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import colors from "@/constants/colors";
import { CapsuleMediaControls } from "@/components/CapsuleMediaControls";
import {
  ensureAudioMode,
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

  // expo-audio: creates an AudioPlayer whose lifecycle is tied to this component.
  // Passing null keeps the player idle. 250 ms = position scrubber update rate.
  const player = useAudioPlayer(uri ? { uri } : null, 250);
  // Reactive status — replaces the expo-av setOnPlaybackStatusUpdate callback.
  const status = useAudioPlayerStatus(player);

  // UI state that needs to trigger re-renders.
  const [muted, setMuted] = useState(false);
  const [feedAudible, setFeedAudible] = useState(false);

  // Behavioural refs that don't need to cause re-renders.
  const endedRef = useRef(false);
  const controllerIdRef = useRef<symbol | null>(null);
  const prevPlayingRef = useRef<boolean | null>(null);

  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const onPlaybackFinishedRef = useRef(onPlaybackFinished);
  onPlaybackFinishedRef.current = onPlaybackFinished;

  // Derived values from status (expo-audio uses seconds; UI expects milliseconds).
  const playing = status.playing;
  const positionMs = Math.round(status.currentTime * 1000);
  const durationMs = Math.round(status.duration * 1000);
  // Consider loaded once the duration is known (expo-audio resolves this async).
  const loading = !!uri && status.duration === 0 && !status.didJustFinish;

  // Notify parent of playing state changes without firing on mount.
  useEffect(() => {
    if (prevPlayingRef.current === playing) return;
    prevPlayingRef.current = playing;
    onPlayingChangeRef.current?.(playing);
  }, [playing]);

  // Reset all local state when the audio source changes.
  useEffect(() => {
    setMuted(false);
    setFeedAudible(false);
    endedRef.current = false;
    prevPlayingRef.current = null;
  }, [uri]);

  // Seek back to the beginning and fire the finished callback when playback ends.
  useEffect(() => {
    if (!status.didJustFinish) return;
    endedRef.current = true;
    onPlayingChangeRef.current?.(false);
    onPlaybackFinishedRef.current?.();
    player.seekTo(0);
  }, [status.didJustFinish, player]);

  // Register with the coordinator so other media can pause this player.
  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      player.pause();
      setFeedAudible(false);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, [player]);

  // Pause when the app moves to the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        player.pause();
        setFeedAudible(false);
      }
    });
    return () => sub.remove();
  }, [player]);

  // Auto-play: trigger once the source has loaded.
  useEffect(() => {
    if (!autoPlay || loading || !uri) return;
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void (async () => {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 1;
      player.seekTo(0);
      player.play();
      setMuted(false);
      endedRef.current = false;
    })();
    // Only fire once when loading resolves — exhaustive deps would re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, uri]);

  // Feed auto-play: muted playback when the feed cell scrolls into view.
  useEffect(() => {
    if (!feedMediaFocused) {
      setFeedAudible(false);
      player.pause();
      return;
    }
    if (loading || !uri) return;
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void (async () => {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 0;
      player.seekTo(0);
      player.play();
      setMuted(true);
      setFeedAudible(false);
      endedRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMediaFocused, loading, uri]);

  const togglePlay = useCallback(async () => {
    const cid = controllerIdRef.current;
    if (cid == null) return;

    // Feed cell: first tap unmutes rather than pausing.
    if (feedMediaFocused && !feedAudible) {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 1;
      if (endedRef.current) {
        player.seekTo(0);
        endedRef.current = false;
      }
      player.play();
      setMuted(false);
      setFeedAudible(true);
      return;
    }

    if (playing) {
      player.pause();
    } else {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      if (endedRef.current) {
        player.seekTo(0);
        endedRef.current = false;
      }
      if (!muted) player.volume = 1;
      player.play();
    }
  }, [feedMediaFocused, feedAudible, playing, muted, player]);

  const toggleMute = useCallback(async () => {
    // Feed cell: mute button becomes "unmute / play audibly".
    if (feedMediaFocused) {
      if (!feedAudible) {
        void togglePlay();
        return;
      }
      player.volume = 0;
      setMuted(true);
      setFeedAudible(false);
      return;
    }
    const nextMuted = !muted;
    player.volume = nextMuted ? 0 : 1;
    setMuted(nextMuted);
  }, [feedMediaFocused, feedAudible, muted, player, togglePlay]);

  const seekProgress = useCallback(
    (progress01: number) => {
      if (durationMs <= 0) return;
      const secs = (Math.min(1, Math.max(0, progress01)) * durationMs) / 1000;
      player.seekTo(secs);
      endedRef.current = false;
    },
    [durationMs, player],
  );

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
      onSeek={seekProgress}
      disabled={loading}
    />
  );
}
