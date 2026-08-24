export type FeedPageMixRow = {
  id: number;
  feedPriority?: number | null;
  authorId?: number | null;
  authorIsSeed?: boolean | null;
};

/**
 * Interleave ranking tiers on a single page so own / friends / community / seed
 * don't land as consecutive walls. Does not drop rows (cursor stays valid).
 */
export function mixFeedPageByTier<T extends FeedPageMixRow>(posts: T[]): T[] {
  if (posts.length <= 1) return posts;

  const queues = new Map<number, T[]>();
  const order: number[] = [];
  for (const post of posts) {
    const tier = Number(post.feedPriority ?? 0);
    if (!queues.has(tier)) {
      queues.set(tier, []);
      order.push(tier);
    }
    queues.get(tier)!.push(post);
  }
  if (queues.size <= 1) return posts;

  order.sort((a, b) => a - b);
  const mixed: T[] = [];
  while (mixed.length < posts.length) {
    let emitted = false;
    for (const tier of order) {
      const next = queues.get(tier)?.shift();
      if (!next) continue;
      mixed.push(next);
      emitted = true;
    }
    if (!emitted) break;
  }
  return mixed;
}
