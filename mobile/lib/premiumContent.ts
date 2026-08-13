/** True when the API stripped full text or playback for the current viewer. */
export function isPremiumContentLocked(item: {
  isPremium?: boolean | null;
  contentLocked?: boolean | null;
}): boolean {
  return Boolean(item.isPremium && item.contentLocked);
}

/** Whether premium body/media should be blurred for the current viewer. */
export function shouldBlurPremiumForViewer(
  item: { isPremium?: boolean | null },
  subscribed: boolean,
): boolean {
  return Boolean(item.isPremium && !subscribed);
}

/** Feed/detail posts — authors always see their own premium content. */
export function shouldBlurPremiumPostForViewer(
  post: { isPremium?: boolean | null; authorId?: number | null },
  subscribed: boolean,
  viewerUserId?: number | null,
): boolean {
  if (!post.isPremium || subscribed) return false;
  if (viewerUserId != null && post.authorId != null && viewerUserId === post.authorId) {
    return false;
  }
  return true;
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
