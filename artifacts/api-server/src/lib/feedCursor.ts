import type { PostWithMeta } from "./postHelpers";

/** Keyset pagination for feed ordered by COALESCE(boosted_at, created_at) DESC, id DESC. */
export type FeedCursorDecoded = { k: number; i: number };

export function encodeFeedCursor(row: Pick<PostWithMeta, "boostedAt" | "createdAt" | "id">): string {
  const coalesce = row.boostedAt ?? row.createdAt;
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
