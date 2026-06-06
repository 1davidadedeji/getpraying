/**
 * Single active media policy: post video and post audio register a pause
 * callback; before any clip starts (or un-mutes), all other registered players pause.
 *
 * The expo-av sound cache has been removed — each CapsuleAudioPlayer manages
 * its own AudioPlayer via expo-audio's useAudioPlayer hook, which handles
 * async loading without blocking the iOS media thread.
 */

import { setAudioModeAsync } from "expo-audio";
import { AppState } from "react-native";

const controllers = new Map<symbol, () => Promise<void>>();
let audioModeConfigured = false;
let appBackgroundPauseInstalled = false;

/**
 * Ensures iOS plays audio even when the physical silent switch is on.
 * Safe to call multiple times — the native call is made only once.
 */
export async function ensureAudioMode(): Promise<void> {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    /* non-fatal */
  }
}

export function registerMediaController(pause: () => Promise<void>): {
  id: symbol;
  unregister: () => void;
} {
  const id = Symbol("media");
  controllers.set(id, pause);
  return {
    id,
    unregister: () => controllers.delete(id),
  };
}

/** Pause feed/detail media when the app leaves the foreground. */
export function ensureAppBackgroundMediaPause(): void {
  if (appBackgroundPauseInstalled) return;
  appBackgroundPauseInstalled = true;
  AppState.addEventListener("change", (state) => {
    if (state !== "active") void pauseAllMediaExcept(null);
  });
}

/** Pause every registered player except the one identified by keepId. */
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
