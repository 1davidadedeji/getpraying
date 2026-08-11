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
import { resolveCachedAudioUri } from "@/lib/audioMediaCache";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Props = {
  audioUrl: string | null | undefined;
  accentColor?: string;
  backgroundColor?: string;
  feedMediaFocused?: boolean;
  /** Return false to block playback (e.g. premium gate). */
  onBeforePlay?: () => boolean;
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
  onBeforePlay,
}: Props) {
  const remoteUri = resolveMediaUrl(audioUrl ?? null);
  // Optimistic: mount the player with the remote URL immediately (no await on cache).
  const [playUri, setPlayUri] = useState<string | null>(remoteUri);
  const [playPending, setPlayPending] = useState(false);

  useEffect(() => {
    if (!remoteUri) {
      setPlayUri(null);
      return;
    }
    setPlayUri(remoteUri);
    let cancelled = false;
    void resolveCachedAudioUri(audioUrl).then((resolved) => {
      if (cancelled || !resolved || resolved === remoteUri) return;
      setPlayUri(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [remoteUri, audioUrl]);

  const player = useAudioPlayer(playUri ? { uri: playUri } : null, 250);
  const status = useAudioPlayerStatus(player);

  const [muted, setMuted] = useState(false);
  const [feedAudible, setFeedAudible] = useState(false);

  const endedRef = useRef(false);
  const controllerIdRef = useRef<symbol | null>(null);
  const prevPlayingRef = useRef<boolean | null>(null);

  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const onPlaybackFinishedRef = useRef(onPlaybackFinished);
  onPlaybackFinishedRef.current = onPlaybackFinished;

  const playing = status.playing;
  const positionMs = Math.round(status.currentTime * 1000);
  const durationMs = Math.round(status.duration * 1000);
  const showBufferingSpinner = playPending && status.isBuffering;

  useEffect(() => {
    if (playing) setPlayPending(false);
  }, [playing]);

  useEffect(() => {
    if (prevPlayingRef.current === playing) return;
    prevPlayingRef.current = playing;
    onPlayingChangeRef.current?.(playing);
  }, [playing]);

  useEffect(() => {
    setMuted(false);
    setFeedAudible(false);
    setPlayPending(false);
    endedRef.current = false;
    prevPlayingRef.current = null;
  }, [playUri]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    endedRef.current = true;
    setPlayPending(false);
    onPlayingChangeRef.current?.(false);
    onPlaybackFinishedRef.current?.();
    player.seekTo(0);
  }, [status.didJustFinish, player]);

  useEffect(() => {
    const { id, unregister } = registerMediaController(async () => {
      player.pause();
      setFeedAudible(false);
      setPlayPending(false);
    });
    controllerIdRef.current = id;
    return () => {
      unregister();
      controllerIdRef.current = null;
    };
  }, [player]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        player.pause();
        setFeedAudible(false);
        setPlayPending(false);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!autoPlay || !playUri) return;
    if (onBeforePlay?.() === false) return;
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void (async () => {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 1;
      player.seekTo(0);
      setPlayPending(true);
      player.play();
      setMuted(false);
      endedRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, playUri]);

  useEffect(() => {
    if (!feedMediaFocused) {
      setFeedAudible(false);
      setPlayPending(false);
      player.pause();
      return;
    }
    if (!playUri) return;
    const cid = controllerIdRef.current;
    if (cid == null) return;
    void (async () => {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 0;
      player.seekTo(0);
      setPlayPending(true);
      player.play();
      setMuted(true);
      setFeedAudible(false);
      endedRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMediaFocused, playUri]);

  const togglePlay = useCallback(async () => {
    const cid = controllerIdRef.current;
    if (cid == null || !playUri) return;

    if (onBeforePlay?.() === false) return;

    if (feedMediaFocused && !feedAudible) {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      player.volume = 1;
      if (endedRef.current) {
        player.seekTo(0);
        endedRef.current = false;
      }
      setPlayPending(true);
      player.play();
      setMuted(false);
      setFeedAudible(true);
      return;
    }

    if (playing) {
      player.pause();
      setPlayPending(false);
    } else {
      await pauseAllMediaExcept(cid);
      await ensureAudioMode();
      if (endedRef.current) {
        player.seekTo(0);
        endedRef.current = false;
      }
      if (!muted) player.volume = 1;
      setPlayPending(true);
      player.play();
    }
  }, [feedMediaFocused, feedAudible, playing, muted, player, playUri, onBeforePlay]);

  const toggleMute = useCallback(async () => {
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

  if (!remoteUri) return null;

  const feedSilent = feedMediaFocused && !feedAudible;

  return (
    <CapsuleMediaControls
      loading={showBufferingSpinner}
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
      disabled={false}
    />
  );
}
