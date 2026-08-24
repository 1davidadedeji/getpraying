import { describe, expect, it } from "vitest";
import {
  computeFeedPagePriority,
  computeLoggedOutFeedPagePriority,
  FEED_PAGE_PRIORITY,
} from "./feedPagePriority";

describe("computeFeedPagePriority", () => {
  it("puts the viewer's own post first even without follows or boosts", () => {
    expect(
      computeFeedPagePriority({
        isOwnPost: true,
        isRealAuthor: true,
        hasRelationship: false,
        hasCategoryAffinity: false,
      }),
    ).toBe(FEED_PAGE_PRIORITY.OWN);
  });

  it("ranks followed or engaged-with authors above strangers", () => {
    expect(
      computeFeedPagePriority({
        isOwnPost: false,
        isRealAuthor: true,
        hasRelationship: true,
        hasCategoryAffinity: false,
      }),
    ).toBe(FEED_PAGE_PRIORITY.RELATIONSHIP);
  });

  it("recommends real posts in a similar niche before unrelated community posts", () => {
    expect(
      computeFeedPagePriority({
        isOwnPost: false,
        isRealAuthor: true,
        hasRelationship: false,
        hasCategoryAffinity: true,
      }),
    ).toBe(FEED_PAGE_PRIORITY.AFFINITY);
  });

  it("keeps unrelated real community posts above seed accounts", () => {
    expect(
      computeFeedPagePriority({
        isOwnPost: false,
        isRealAuthor: true,
        hasRelationship: false,
        hasCategoryAffinity: false,
      }),
    ).toBe(FEED_PAGE_PRIORITY.OTHER_REAL);
    expect(
      computeFeedPagePriority({
        isOwnPost: false,
        isRealAuthor: false,
        hasRelationship: true,
        hasCategoryAffinity: true,
      }),
    ).toBe(FEED_PAGE_PRIORITY.SEED);
  });
});

describe("computeLoggedOutFeedPagePriority", () => {
  it("surfaces boosted posts, then real authors, then seed", () => {
    expect(computeLoggedOutFeedPagePriority({ isBoosted: true, isRealAuthor: false })).toBe(0);
    expect(computeLoggedOutFeedPagePriority({ isBoosted: false, isRealAuthor: true })).toBe(1);
    expect(computeLoggedOutFeedPagePriority({ isBoosted: false, isRealAuthor: false })).toBe(2);
  });
});
