/** True when the API stripped full text or playback for the current viewer. */
export function isPremiumContentLocked(item: {
  isPremium?: boolean | null;
  contentLocked?: boolean | null;
}): boolean {
  return Boolean(item.isPremium && item.contentLocked);
}

/** Premium media (video/audio) stripped for free users — show lock UI instead of player. */
export function isPremiumMediaLocked(item: {
  isPremium?: boolean | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
}): boolean {
  if (!item.isPremium) return false;
  const t = item.mediaType?.toLowerCase();
  if (t !== "video" && t !== "audio") return false;
  return !item.mediaUrl?.trim();
}
