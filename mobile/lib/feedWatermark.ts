/**
 * Server-provided latest feed-visible timestamp from GET `/posts`
 * (`coalesce(approved_at, created_at)`). Used as the watermark for
 * GET `/posts/new-count?maxKnownCreatedAt=…` so a post approved after
 * create still shows the “new prayers” pill. Boost sorting cannot hide it.
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
