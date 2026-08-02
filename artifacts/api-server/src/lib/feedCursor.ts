import type { PostWithMeta } from "./postHelpers";

/**
 * Keyset pagination for the home feed timeline: by default `COALESCE(boosted_at, created_at)` DESC, id DESC.
 * For authenticated viewers, boosted posts use `created_at` instead when the viewer has already
 * prayed, saved, or commented — so boosts mostly resurface for users who have not engaged yet.
 *
 * When `feedPriority` is set (authenticated personalized feed), ordering is:
 * priority tier ASC (0 = engaged authors first), then sort timestamp DESC, then id DESC.
 */
export type FeedCursorDecoded = { p: number; k: number; i: number };

/** Timestamp used to order the feed and keyset cursors (must match `feedTimelineSortTsExpr` in routes). */
export function feedSortTimestampForCursor(
  row: Pick<PostWithMeta, "boostedAt" | "createdAt" | "id" | "hasPrayed" | "hasCommented" | "isSaved">,
): Date {
  const engaged =
    row.boostedAt != null && (row.hasPrayed || row.hasCommented || row.isSaved);
  return engaged ? row.createdAt : (row.boostedAt ?? row.createdAt);
}

export function encodeFeedCursor(
  row: Pick<PostWithMeta, "boostedAt" | "createdAt" | "id" | "hasPrayed" | "hasCommented" | "isSaved">,
  feedPriority?: number,
): string {
  const coalesce = feedSortTimestampForCursor(row);
  const payload = { p: feedPriority ?? 1, k: coalesce.getTime(), i: row.id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFeedCursor(raw: string | undefined): FeedCursorDecoded | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const trimmed = raw.trim();
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const j = JSON.parse(json) as { p?: unknown; k?: unknown; i?: unknown };
    if (typeof j.k !== "number" || typeof j.i !== "number" || Number.isNaN(j.k) || Number.isNaN(j.i)) {
      return null;
    }
    const p = typeof j.p === "number" && !Number.isNaN(j.p) ? j.p : 1;
    return { p, k: j.k, i: j.i };
  } catch {
    return null;
  }
}
