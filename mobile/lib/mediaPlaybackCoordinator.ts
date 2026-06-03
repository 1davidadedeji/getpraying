/**
 * Single active media policy: official guides, post video, and post audio register a pause
 * callback; before any clip starts (or un-mutes), all other registered players pause.
 */

import { Audio } from "expo-av";
import { AppState } from "react-native";

const controllers = new Map<symbol, () => Promise<void>>();

type CachedSoundEntry = {
  sound: Audio.Sound;
  refCount: number;
  durationMs: number;
};

const soundCache = new Map<string, CachedSoundEntry>();
const SOUND_CACHE_TTL_MS = 90_000;
const soundCacheTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearSoundCacheTimer(uri: string): void {
  const t = soundCacheTimers.get(uri);
  if (t) {
    clearTimeout(t);
    soundCacheTimers.delete(uri);
  }
}

function scheduleSoundEviction(uri: string): void {
  clearSoundCacheTimer(uri);
  soundCacheTimers.set(
    uri,
    setTimeout(() => {
      const entry = soundCache.get(uri);
      if (!entry || entry.refCount > 0) return;
      void entry.sound.unloadAsync().catch(() => {});
      soundCache.delete(uri);
      soundCacheTimers.delete(uri);
    }, SOUND_CACHE_TTL_MS),
  );
}

export function registerMediaController(pause: () => Promise<void>): {
  id: symbol;
  unregister: () => void;
} {
  const id = Symbol("media");
  controllers.set(id, pause);
  return {
    id,
    unregister: () => {
      controllers.delete(id);
    },
  };
}

let appBackgroundPauseInstalled = false;

/** Pause feed/detail media when the app leaves the foreground (avoids resume freezes). */
export function ensureAppBackgroundMediaPause(): void {
  if (appBackgroundPauseInstalled) return;
  appBackgroundPauseInstalled = true;
  AppState.addEventListener("change", (state) => {
    if (state !== "active") void pauseAllMediaExcept(null);
  });
}

/** Pause every registered player except the one identified by keepId (if provided). */
export async function pauseAllMediaExcept(keepId: symbol | null): Promise<void> {
  for (const [id, pause] of controllers) {
    if (keepId !== null && id === keepId) continue;
    try {
      await pause();
    } catch {
      /* ignore */
    }
  }
}

/** Reuse loaded expo-av sounds across feed cell remounts to avoid reload spinners. */
export async function acquireCachedSound(uri: string): Promise<{
  sound: Audio.Sound;
  durationMs: number;
  release: () => void;
}> {
  clearSoundCacheTimer(uri);
  const existing = soundCache.get(uri);
  if (existing) {
    existing.refCount += 1;
    return {
      sound: existing.sound,
      durationMs: existing.durationMs,
      release: () => {
        existing.refCount = Math.max(0, existing.refCount - 1);
        if (existing.refCount === 0) scheduleSoundEviction(uri);
      },
    };
  }

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: false, isLooping: false, positionMillis: 0 },
  );
  const status = await sound.getStatusAsync();
  const durationMs =
    status.isLoaded && typeof status.durationMillis === "number" ? status.durationMillis : 0;

  const entry: CachedSoundEntry = { sound, refCount: 1, durationMs };
  soundCache.set(uri, entry);
  return {
    sound,
    durationMs,
    release: () => {
      entry.refCount = Math.max(0, entry.refCount - 1);
      if (entry.refCount === 0) scheduleSoundEviction(uri);
    },
  };
}
