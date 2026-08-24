/** Home feed page priority (lower = higher in the list). */
export const FEED_PAGE_PRIORITY = {
  OWN: 0,
  RELATIONSHIP: 1,
  AFFINITY: 2,
  OTHER_REAL: 3,
  SEED: 4,
} as const;

export type FeedPagePriorityInput = {
  isOwnPost: boolean;
  isRealAuthor: boolean;
  hasRelationship: boolean;
  hasCategoryAffinity: boolean;
};

/**
 * Signed-in ranking:
 * 0 own posts (so a new prayer is not buried under boosts)
 * 1 people the viewer follows or has prayed/saved/commented with
 * 2 similar niche (preferred categories / engaged categories)
 * 3 other real community
 * 4 seed / anonymous
 *
 * Boost is a timestamp bump within a tier, not a wall above the feed.
 */
export function computeFeedPagePriority(input: FeedPagePriorityInput): number {
  if (input.isOwnPost) return FEED_PAGE_PRIORITY.OWN;
  if (!input.isRealAuthor) return FEED_PAGE_PRIORITY.SEED;
  if (input.hasRelationship) return FEED_PAGE_PRIORITY.RELATIONSHIP;
  if (input.hasCategoryAffinity) return FEED_PAGE_PRIORITY.AFFINITY;
  return FEED_PAGE_PRIORITY.OTHER_REAL;
}

export type LoggedOutFeedPagePriorityInput = {
  isBoosted: boolean;
  isRealAuthor: boolean;
};

/** Logged-out: boosted → real → seed/anonymous. */
export function computeLoggedOutFeedPagePriority(
  input: LoggedOutFeedPagePriorityInput,
): number {
  if (input.isBoosted) return 0;
  if (input.isRealAuthor) return 1;
  return 2;
}
