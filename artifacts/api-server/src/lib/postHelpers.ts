import { db, postsTable, usersTable, postPrayersTable, savedPostsTable, commentsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { parseCategoryTagsFromRow } from "./categoryTags";

export type PostWithMeta = {
  id: number;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  category: string | null;
  /** All tag slugs (primary display + extras); empty if none */
  categories: string[];
  isAnonymous: boolean;
  status: string;
  flagReason: string | null;
  moderationReason: string | null;
  prayCount: number;
  commentCount: number;
  saveCount: number;
  hasPrayed: boolean;
  hasCommented: boolean;
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

  let hasCommented = false;
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

    const [commentRow] = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.postId, post.id), eq(commentsTable.authorId, userId)))
      .limit(1);
    hasCommented = !!commentRow;
  }

  const [commentRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentsTable)
    .where(eq(commentsTable.postId, post.id));
  const commentCount = Number(commentRow?.count ?? 0);

  const [saveRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(savedPostsTable)
    .where(eq(savedPostsTable.postId, post.id));
  const saveCount = Number(saveRow?.count ?? 0);

  const categories = parseCategoryTagsFromRow({
    category: post.category,
    categoryTags: post.categoryTags,
  });
  return {
    id: post.id,
    content: post.content,
    mediaUrl: post.mediaUrl ?? null,
    mediaType: post.mediaType ?? null,
    category: post.category ?? null,
    categories,
    isAnonymous: post.isAnonymous,
    status: post.status,
    flagReason: post.flagReason ?? null,
    moderationReason: post.moderationReason ?? null,
    prayCount: post.prayCount,
    commentCount,
    saveCount,
    hasPrayed,
    hasCommented,
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
  let commentedSet = new Set<number>();
  const postIds = posts.map((p) => p.id);

  if (userId && posts.length > 0) {
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
    const commentRows = await db
      .select({ postId: commentsTable.postId })
      .from(commentsTable)
      .where(and(inArray(commentsTable.postId, postIds), eq(commentsTable.authorId, userId)));
    for (const r of commentRows) commentedSet.add(r.postId);
  }

  const commentCountMap = new Map<number, number>();
  const saveCountMap = new Map<number, number>();
  if (postIds.length > 0) {
    const commentCounts = await db
      .select({ postId: commentsTable.postId, count: sql<number>`count(*)` })
      .from(commentsTable)
      .where(inArray(commentsTable.postId, postIds))
      .groupBy(commentsTable.postId);
    for (const r of commentCounts) commentCountMap.set(r.postId, Number(r.count));

    const saveCounts = await db
      .select({ postId: savedPostsTable.postId, count: sql<number>`count(*)` })
      .from(savedPostsTable)
      .where(inArray(savedPostsTable.postId, postIds))
      .groupBy(savedPostsTable.postId);
    for (const r of saveCounts) saveCountMap.set(r.postId, Number(r.count));
  }

  return posts.map((post) => {
    const author = post.isAnonymous ? null : (post.authorId ? authorsMap.get(post.authorId) ?? null : null);
    const categories = parseCategoryTagsFromRow({
      category: post.category,
      categoryTags: post.categoryTags,
    });
    return {
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl ?? null,
      mediaType: post.mediaType ?? null,
      category: post.category ?? null,
      categories,
      isAnonymous: post.isAnonymous,
      status: post.status,
      flagReason: post.flagReason ?? null,
      moderationReason: post.moderationReason ?? null,
      prayCount: post.prayCount,
      commentCount: commentCountMap.get(post.id) ?? 0,
      saveCount: saveCountMap.get(post.id) ?? 0,
      hasPrayed: prayedSet.has(post.id),
      hasCommented: commentedSet.has(post.id),
      isSaved: savedSet.has(post.id),
      authorId: post.isAnonymous ? null : (post.authorId ?? null),
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      createdAt: post.createdAt,
    };
  });
}
