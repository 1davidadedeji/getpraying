import { describe, expect, it } from "vitest";
import { decodeFeedCursor, encodeFeedCursor } from "./feedCursor";

describe("feedCursor priority", () => {
  const row = {
    id: 42,
    boostedAt: null as Date | null,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    hasPrayed: false,
    hasCommented: false,
    isSaved: false,
  };

  it("encodes and decodes priority tier", () => {
    const cursor = encodeFeedCursor(row, 0);
    const decoded = decodeFeedCursor(cursor);
    expect(decoded).toEqual({ p: 0, k: row.createdAt.getTime(), i: 42 });
  });

  it("defaults missing priority to tier 1 for legacy cursors", () => {
    const legacy = Buffer.from(JSON.stringify({ k: 1, i: 2 }), "utf8").toString("base64url");
    expect(decodeFeedCursor(legacy)).toEqual({ p: 1, k: 1, i: 2 });
  });
});
