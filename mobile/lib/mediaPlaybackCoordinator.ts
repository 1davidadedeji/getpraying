/**
 * Single active media policy: official guides, post video, and post audio register a pause
 * callback; before any clip starts (or un-mutes), all other registered players pause.
 */

const controllers = new Map<symbol, () => Promise<void>>();

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
