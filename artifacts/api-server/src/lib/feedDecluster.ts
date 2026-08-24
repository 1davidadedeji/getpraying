type FeedDeclusterRow = {
  id: number;
  authorId?: number | null;
  authorIsSeed?: boolean | null;
};

type AuthorBucket = "real" | "seed" | "anon";

function authorBucket(row: FeedDeclusterRow): AuthorBucket {
  if (row.authorId == null) return "anon";
  if (row.authorIsSeed) return "seed";
  return "real";
}

/** Reduce back-to-back posts from the same author; spread seed vs real when possible. */
export function declusterFeedPostsByAuthor<T extends FeedDeclusterRow>(posts: T[]): T[] {
  if (posts.length <= 1) return posts;

  const remaining = [...posts];
  const result: T[] = [];
  let lastAuthor: number | null | undefined;
  let lastBucket: AuthorBucket | undefined;

  while (remaining.length > 0) {
    let pickIdx = remaining.findIndex((post) => {
      const bucket = authorBucket(post);
      return (
        (post.authorId ?? null) !== (lastAuthor ?? null) &&
        bucket !== lastBucket
      );
    });
    if (pickIdx < 0) {
      pickIdx = remaining.findIndex((post) => (post.authorId ?? null) !== (lastAuthor ?? null));
    }
    if (pickIdx < 0) {
      pickIdx = remaining.findIndex((post) => authorBucket(post) !== lastBucket);
    }
    if (pickIdx < 0) pickIdx = 0;

    const picked = remaining.splice(pickIdx, 1)[0]!;
    result.push(picked);
    lastAuthor = picked.authorId ?? null;
    lastBucket = authorBucket(picked);
  }

  return result;
}
