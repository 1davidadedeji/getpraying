/** Legacy + typed placeholders stored when a post has media but no caption. */
export const MEDIA_ONLY_POST_MARKERS = ["(Image)", "(Audio)", "(Video)"] as const;

export type MediaOnlyMarker = (typeof MEDIA_ONLY_POST_MARKERS)[number];

export function isMediaOnlyPostContent(content: string | null | undefined): boolean {
  const trimmed = (content ?? "").trim();
  return (MEDIA_ONLY_POST_MARKERS as readonly string[]).includes(trimmed);
}

/** True when the post has no user-written caption (empty or media-only marker). */
export function isMediaOnlyPost(
  content: string | null | undefined,
  hasMedia: boolean,
): boolean {
  const trimmed = (content ?? "").trim();
  if (!trimmed && hasMedia) return true;
  return isMediaOnlyPostContent(trimmed);
}
