let feedAudioUnlocked = false;
const listeners = new Set<() => void>();

export function getFeedAudioUnlocked(): boolean {
  return feedAudioUnlocked;
}

export function setFeedAudioUnlocked(unlocked: boolean): void {
  if (feedAudioUnlocked === unlocked) return;
  feedAudioUnlocked = unlocked;
  for (const listener of listeners) listener();
}

export function resetFeedAudioUnlocked(): void {
  setFeedAudioUnlocked(false);
}

export function subscribeFeedAudioUnlocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
