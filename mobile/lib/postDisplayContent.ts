/** Placeholders stored for media-only posts (legacy `(Image)` covered all media types). */
export const MEDIA_ONLY_POST_MARKERS = new Set(["(Image)", "(Audio)", "(Video)"]);

/** Caption text safe to show in feed, detail, and share — hides media-only placeholders. */
export function postTextForDisplay(
  content: string | null | undefined,
  opts?: { mediaUrl?: string | null; mediaType?: string | null },
): string {
  const trimmed = (content ?? "").trim();
  if (MEDIA_ONLY_POST_MARKERS.has(trimmed)) return "";
  if (!trimmed && opts?.mediaUrl?.trim()) return "";
  return trimmed;
}
