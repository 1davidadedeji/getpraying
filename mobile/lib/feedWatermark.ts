import type { Post } from "@workspace/api-client-react";

/**
 * Base64url watermark for the current top feed item, matching
 * {@link encodeFeedCursor} on the server (`k` = sort key millis, `i` = post id).
 */
export function encodeFeedTopWatermark(post: Pick<Post, "id" | "createdAt" | "boostedAt">): string {
  const raw = post.boostedAt ?? post.createdAt;
  const k = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (!Number.isFinite(k)) {
    throw new Error("feed watermark: invalid timestamps on post");
  }
  const payload = JSON.stringify({ k, i: post.id }) as string;
  const b64 = globalThis.btoa(payload);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
