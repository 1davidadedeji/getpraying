import { describe, expect, it } from "vitest";
import { mixFeedPageByTier } from "./feedPageMix";

describe("mixFeedPageByTier", () => {
  it("round-robins own / relationship / other / seed instead of dumping one wall", () => {
    const posts = [
      { id: 1, feedPriority: 0, authorId: 1 },
      { id: 2, feedPriority: 0, authorId: 1 },
      { id: 3, feedPriority: 0, authorId: 1 },
      { id: 10, feedPriority: 1, authorId: 2 },
      { id: 11, feedPriority: 1, authorId: 3 },
      { id: 20, feedPriority: 3, authorId: 4 },
      { id: 30, feedPriority: 4, authorId: 5, authorIsSeed: true },
    ];
    const mixed = mixFeedPageByTier(posts);
    expect(mixed.map((p) => p.id).sort()).toEqual(posts.map((p) => p.id).sort());
    expect(mixed.slice(0, 4).map((p) => p.feedPriority)).toEqual([0, 1, 3, 4]);
  });

  it("keeps a single-tier page in original order", () => {
    const posts = [
      { id: 1, feedPriority: 3, authorId: 8 },
      { id: 2, feedPriority: 3, authorId: 9 },
    ];
    expect(mixFeedPageByTier(posts).map((p) => p.id)).toEqual([1, 2]);
  });
});
