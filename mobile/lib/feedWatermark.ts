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
  const trimmed = globalNewestCreatedAt.trim();
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  // Keep the server ISO as-is (already ms-precision); re-stringifying can drift vs Postgres.
  return trimmed;
}
