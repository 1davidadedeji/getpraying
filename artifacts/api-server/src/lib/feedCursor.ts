import type { PostWithMeta } from "./postHelpers";

/**
 * Keyset pagination for the home feed timeline: by default `COALESCE(boosted_at, created_at)` DESC, id DESC.
 * For authenticated viewers, boosted posts use `created_at` instead when the viewer has already
 * prayed, saved, or commented — so boosts mostly resurface for users who have not engaged yet.
 */
export type FeedCursorDecoded = { k: number; i: number };

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
): string {
  const coalesce = feedSortTimestampForCursor(row);
  const payload = { k: coalesce.getTime(), i: row.id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFeedCursor(raw: string | undefined): FeedCursorDecoded | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const trimmed = raw.trim();
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const j = JSON.parse(json) as { k?: unknown; i?: unknown };
    if (typeof j.k !== "number" || typeof j.i !== "number" || Number.isNaN(j.k) || Number.isNaN(j.i)) {
      return null;
    }
    return { k: j.k, i: j.i };
  } catch {
    return null;
  }
}
