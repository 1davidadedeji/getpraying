import { describe, expect, it } from "vitest";
import { declusterFeedPostsByAuthor } from "./feedDecluster";

describe("declusterFeedPostsByAuthor", () => {
  it("spreads consecutive posts from the same author when alternatives exist", () => {
    const posts = [
      { id: 1, authorId: 10 },
      { id: 2, authorId: 10 },
      { id: 3, authorId: 20 },
      { id: 4, authorId: 20 },
    ];
    const result = declusterFeedPostsByAuthor(posts);
    expect(result[0]!.authorId).not.toBe(result[1]!.authorId);
    expect(result.map((p) => p.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it("returns single-item lists unchanged", () => {
    expect(declusterFeedPostsByAuthor([{ id: 1, authorId: 5 }])).toEqual([{ id: 1, authorId: 5 }]);
  });
});
