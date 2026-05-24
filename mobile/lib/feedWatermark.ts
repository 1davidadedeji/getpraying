/**
 * Server-provided latest approved `created_at` from GET `/posts`.
 * Used as the watermark for GET `/posts/new-count?maxKnownCreatedAt=…` so boost
 * sorting on the feed page cannot hide newer posts from the poll.
 */
export function pickFeedWatermarkIso(
  globalNewestCreatedAt: string | null | undefined,
): string | null {
  if (typeof globalNewestCreatedAt !== "string" || !globalNewestCreatedAt.trim()) {
    return null;
  }
  const ms = Date.parse(globalNewestCreatedAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}
