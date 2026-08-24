export function shouldJumpFeedToTopOnTabPress(input: {
  feedTabAlreadyFocused: boolean;
}): boolean {
  return input.feedTabAlreadyFocused;
}

export function shouldReplaceFeedOnSilentRefresh(input: {
  scrollY: number;
  postCount: number;
  pageSize: number;
}): boolean {
  if (input.scrollY > 80) return false;
  if (input.postCount > input.pageSize) return false;
  return true;
}

export const FEED_PREFETCH_REMAINING_ITEMS = 8;

export function shouldPrefetchNextFeedPage(input: {
  remainingItems: number;
  hasNextPage: boolean;
  alreadyLoading: boolean;
}): boolean {
  if (!input.hasNextPage || input.alreadyLoading) return false;
  return input.remainingItems <= FEED_PREFETCH_REMAINING_ITEMS;
}
