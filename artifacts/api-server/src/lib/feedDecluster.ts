/** Reduce back-to-back posts from the same author within a feed page. */
export function declusterFeedPostsByAuthor<
  T extends { id: number; authorId?: number | null },
>(posts: T[]): T[] {
  if (posts.length <= 1) return posts;

  const remaining = [...posts];
  const result: T[] = [];
  let lastAuthor: number | null | undefined;

  while (remaining.length > 0) {
    let pickIdx = remaining.findIndex((p) => (p.authorId ?? null) !== (lastAuthor ?? null));
    if (pickIdx < 0) pickIdx = 0;
    const picked = remaining.splice(pickIdx, 1)[0]!;
    result.push(picked);
    lastAuthor = picked.authorId ?? null;
  }

  return result;
}
