import { db, postsTable, usersTable, postPrayersTable, savedPostsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export type PostWithMeta = {
  id: number;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  category: string | null;
  isAnonymous: boolean;
  status: string;
  flagReason: string | null;
  prayCount: number;
  hasPrayed: boolean;
  isSaved: boolean;
  authorId: number | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  createdAt: Date;
};

export async function enrichPost(post: typeof postsTable.$inferSelect, userId?: number): Promise<PostWithMeta> {
  let author = null;
  if (post.authorId && !post.isAnonymous) {
    const [a] = await db.select().from(usersTable).where(eq(usersTable.id, post.authorId));
    author = a ?? null;
  }

  let hasPrayed = false;
  let isSaved = false;

  if (userId) {
    const [prayedRow] = await db
      .select()
      .from(postPrayersTable)
      .where(and(eq(postPrayersTable.postId, post.id), eq(postPrayersTable.userId, userId)))
      .limit(1);
    hasPrayed = !!prayedRow;

    const [savedRow] = await db
      .select()
      .from(savedPostsTable)
      .where(and(eq(savedPostsTable.postId, post.id), eq(savedPostsTable.userId, userId)))
      .limit(1);
    isSaved = !!savedRow;
  }

  return {
    id: post.id,
    content: post.content,
    mediaUrl: post.mediaUrl ?? null,
    mediaType: post.mediaType ?? null,
    category: post.category ?? null,
    isAnonymous: post.isAnonymous,
    status: post.status,
    flagReason: post.flagReason ?? null,
    prayCount: post.prayCount,
    hasPrayed,
    isSaved,
    authorId: post.isAnonymous ? null : (post.authorId ?? null),
    authorUsername: post.isAnonymous ? null : (author?.username ?? null),
    authorDisplayName: post.isAnonymous ? null : (author?.displayName ?? null),
    authorAvatarUrl: post.isAnonymous ? null : (author?.avatarUrl ?? null),
    createdAt: post.createdAt,
  };
}

export async function enrichPosts(posts: typeof postsTable.$inferSelect[], userId?: number): Promise<PostWithMeta[]> {
  // Bulk load authors
  const authorIds = posts.filter((p) => !p.isAnonymous && p.authorId != null).map((p) => p.authorId!);
  let authorsMap = new Map<number, typeof usersTable.$inferSelect>();
  if (authorIds.length > 0) {
    const authors = await db.select().from(usersTable).where(inArray(usersTable.id, authorIds));
    for (const a of authors) authorsMap.set(a.id, a);
  }

  let prayedSet = new Set<number>();
  let savedSet = new Set<number>();
  if (userId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const prayedRows = await db
      .select()
      .from(postPrayersTable)
      .where(and(inArray(postPrayersTable.postId, postIds), eq(postPrayersTable.userId, userId)));
    for (const r of prayedRows) prayedSet.add(r.postId);
    const savedRows = await db
      .select()
      .from(savedPostsTable)
      .where(and(inArray(savedPostsTable.postId, postIds), eq(savedPostsTable.userId, userId)));
    for (const r of savedRows) savedSet.add(r.postId);
  }

  return posts.map((post) => {
    const author = post.isAnonymous ? null : (post.authorId ? authorsMap.get(post.authorId) ?? null : null);
    return {
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl ?? null,
      mediaType: post.mediaType ?? null,
      category: post.category ?? null,
      isAnonymous: post.isAnonymous,
      status: post.status,
      flagReason: post.flagReason ?? null,
      prayCount: post.prayCount,
      hasPrayed: prayedSet.has(post.id),
      isSaved: savedSet.has(post.id),
      authorId: post.isAnonymous ? null : (post.authorId ?? null),
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      createdAt: post.createdAt,
    };
  });
}
