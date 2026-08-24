import type { PostWithMeta } from "./postHelpers";

/**
 * Keyset pagination for the home feed timeline: by default `COALESCE(boosted_at, created_at)` DESC, id DESC.
 * For authenticated viewers, boosted posts use `created_at` instead when the viewer has already
 * prayed, saved, or commented — so boosts mostly resurface for users who have not engaged yet.
 *
 * When `feedPriority` is set (authenticated For You feed), ordering is:
 * priority tier ASC (0 = own, 1 = relationships, 2 = similar niche, 3 = other real,
 * 4 = seed/anonymous), then sort timestamp DESC, then id DESC.
 * Boost only changes the sort timestamp inside a tier.
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

type FeedCursorSource = Pick<
  PostWithMeta,
  "id" | "boostedAt" | "createdAt" | "hasPrayed" | "hasCommented" | "isSaved"
>;

/** Last row in feed order among a SQL page — stable even when the page is de-clustered for display. */
export function pickFeedPageCursorRow<T extends { id: number }>(
  sqlPage: T[],
  feedPriorityFor: (row: T) => number,
  sortSourceFor: (row: T) => FeedCursorSource,
): T | null {
  if (sqlPage.length === 0) return null;

  let cursorRow = sqlPage[sqlPage.length - 1]!;
  let cursorRank = feedOrderRank(sortSourceFor(cursorRow), feedPriorityFor(cursorRow));

  for (let i = sqlPage.length - 2; i >= 0; i--) {
    const row = sqlPage[i]!;
    const rank = feedOrderRank(sortSourceFor(row), feedPriorityFor(row));
    if (compareFeedOrderRank(rank, cursorRank) > 0) {
      cursorRow = row;
      cursorRank = rank;
    }
  }

  return cursorRow;
}

/** Higher rank = later in the feed (priority tier asc, sort ts desc, id desc). */
function feedOrderRank(row: FeedCursorSource, priority: number): [number, number, number] {
  const sortTs = feedSortTimestampForCursor(row).getTime();
  return [priority, -sortTs, -row.id];
}

function compareFeedOrderRank(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}
