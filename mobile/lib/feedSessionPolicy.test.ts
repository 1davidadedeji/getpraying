import { describe, expect, it } from "vitest";
import {
  shouldJumpFeedToTopOnTabPress,
  shouldPrefetchNextFeedPage,
  shouldReplaceFeedOnSilentRefresh,
} from "./feedSessionPolicy";

describe("shouldJumpFeedToTopOnTabPress", () => {
  it("jumps to top only when Feed is already the focused tab", () => {
    expect(shouldJumpFeedToTopOnTabPress({ feedTabAlreadyFocused: true })).toBe(true);
    expect(shouldJumpFeedToTopOnTabPress({ feedTabAlreadyFocused: false })).toBe(false);
  });
});

describe("shouldReplaceFeedOnSilentRefresh", () => {
  it("keeps the current page when the user has scrolled or already loaded more", () => {
    expect(
      shouldReplaceFeedOnSilentRefresh({ scrollY: 0, postCount: 20, pageSize: 20 }),
    ).toBe(true);
    expect(
      shouldReplaceFeedOnSilentRefresh({ scrollY: 120, postCount: 20, pageSize: 20 }),
    ).toBe(false);
    expect(
      shouldReplaceFeedOnSilentRefresh({ scrollY: 0, postCount: 40, pageSize: 20 }),
    ).toBe(false);
  });
});

describe("shouldPrefetchNextFeedPage", () => {
  it("prefetches while several items remain, not only at the last pixel", () => {
    expect(
      shouldPrefetchNextFeedPage({ remainingItems: 8, hasNextPage: true, alreadyLoading: false }),
    ).toBe(true);
    expect(
      shouldPrefetchNextFeedPage({ remainingItems: 12, hasNextPage: true, alreadyLoading: false }),
    ).toBe(false);
    expect(
      shouldPrefetchNextFeedPage({ remainingItems: 2, hasNextPage: true, alreadyLoading: true }),
    ).toBe(false);
    expect(
      shouldPrefetchNextFeedPage({ remainingItems: 1, hasNextPage: false, alreadyLoading: false }),
    ).toBe(false);
  });
});
