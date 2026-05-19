import type { Post } from "@workspace/api-client-react";

/**
 * Latest `created_at` among posts already loaded in the client feed.
 * Passed to GET `/posts/new-count?maxKnownCreatedAt=…` — count is strictly
 * newer rows only (boost sorting on the feed does not affect this).
 */
export function computeMaxKnownCreatedAtIso(posts: Pick<Post, "createdAt">[]): string | null {
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const p of posts) {
    const ms = typeof p.createdAt === "string" ? Date.parse(p.createdAt) : Number.NaN;
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) bestMs = ms;
  }
  if (!Number.isFinite(bestMs)) return null;
  return new Date(bestMs).toISOString();
}
