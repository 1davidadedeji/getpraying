import { Audio } from "expo-av";

const registered = new Set<Audio.Sound>();

export function registerOfficialGuideSound(sound: Audio.Sound): () => void {
  registered.add(sound);
  return () => {
    registered.delete(sound);
  };
}

/** Pause and reset all other official guide players so only one can play at a time. */
export async function pauseOtherOfficialGuides(keep: Audio.Sound | null): Promise<void> {
  for (const s of registered) {
    if (s === keep) continue;
    try {
      const st = await s.getStatusAsync();
      if (st.isLoaded) {
        await s.pauseAsync();
        await s.setPositionAsync(0);
      }
    } catch {
      /* ignore */
    }
  }
}
