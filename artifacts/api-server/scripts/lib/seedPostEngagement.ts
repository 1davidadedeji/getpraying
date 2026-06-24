import { db, commentsTable, postPrayersTable, postsTable, usersTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { BATCH_SIZE, COMMENT_TEMPLATES, pick, pickN, randInt } from "./seedSocialShared.ts";

export type SeedPostRow = {
  id: number;
  authorId: number | null;
  createdAt: Date;
};

export type SeedUserRow = {
  id: number;
  username: string;
};

/** Remove synthetic engagement on seed-authored posts (comments + prays). Does not delete posts or users. */
export async function wipeEngagementForSeedPosts(postIds: number[]): Promise<void> {
  if (postIds.length === 0) return;
  await db.delete(commentsTable).where(inArray(commentsTable.postId, postIds));
  await db.delete(postPrayersTable).where(inArray(postPrayersTable.postId, postIds));
  await db.update(postsTable).set({ prayCount: 0 }).where(inArray(postsTable.id, postIds));
}

function eligibleCommenters(post: SeedPostRow, seedUsers: SeedUserRow[]): SeedUserRow[] {
  return seedUsers.filter((u) => u.id !== post.authorId);
}

function eligiblePrayers(post: SeedPostRow, seedUsers: SeedUserRow[]): SeedUserRow[] {
  return seedUsers.filter((u) => u.id !== post.authorId);
}

function commentCreatedAt(postCreatedAt: Date, index: number, total: number): Date {
  const postMs = postCreatedAt.getTime();
  const spreadMs = randInt(15, 72) * 60_000;
  const offset = Math.floor((spreadMs * (index + 1)) / (total + 1));
  return new Date(postMs + offset);
}

function prayCreatedAt(postCreatedAt: Date): Date {
  const postMs = postCreatedAt.getTime();
  return new Date(postMs + randInt(5, 120) * 60_000);
}

export function buildCommentRows(posts: SeedPostRow[], seedUsers: SeedUserRow[]) {
  const rows: { postId: number; authorId: number; content: string; createdAt: Date }[] = [];
  for (const post of posts) {
    const pool = eligibleCommenters(post, seedUsers);
    if (pool.length === 0) continue;
    const numComments = randInt(1, Math.min(4, pool.length));
    const commenters = pickN(pool, numComments);
    for (let i = 0; i < commenters.length; i++) {
      const commenter = commenters[i]!;
      rows.push({
        postId: post.id,
        authorId: commenter.id,
        content: pick(COMMENT_TEMPLATES),
        createdAt: commentCreatedAt(post.createdAt, i, commenters.length),
      });
    }
  }
  return rows;
}

export function buildPrayRows(posts: SeedPostRow[], seedUsers: SeedUserRow[]) {
  const rows: { postId: number; userId: number; createdAt: Date }[] = [];
  const seen = new Set<string>();
  for (const post of posts) {
    const pool = eligiblePrayers(post, seedUsers);
    if (pool.length === 0) continue;
    const numPrays = randInt(2, Math.min(45, pool.length));
    const prayers = pickN(pool, numPrays);
    for (const prayer of prayers) {
      const key = `${post.id}:${prayer.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        postId: post.id,
        userId: prayer.id,
        createdAt: prayCreatedAt(post.createdAt),
      });
    }
  }
  return rows;
}

export async function seedEngagementForPosts(
  posts: SeedPostRow[],
  seedUsers: SeedUserRow[],
): Promise<{ commentCount: number; prayCount: number }> {
  if (posts.length === 0 || seedUsers.length === 0) {
    return { commentCount: 0, prayCount: 0 };
  }

  const postIds = posts.map((p) => p.id);
  await wipeEngagementForSeedPosts(postIds);

  const commentRows = buildCommentRows(posts, seedUsers);
  let commentCount = 0;
  for (let i = 0; i < commentRows.length; i += BATCH_SIZE) {
    const batch = commentRows.slice(i, i + BATCH_SIZE);
    await db.insert(commentsTable).values(batch);
    commentCount += batch.length;
  }

  const prayRows = buildPrayRows(posts, seedUsers);
  let prayCount = 0;
  for (let i = 0; i < prayRows.length; i += BATCH_SIZE) {
    const batch = prayRows.slice(i, i + BATCH_SIZE);
    await db.insert(postPrayersTable).values(batch);
    prayCount += batch.length;
  }

  await db
    .update(postsTable)
    .set({
      prayCount: sql`(select count(*)::int from post_prayers pp where pp.post_id = ${postsTable.id})`,
    })
    .where(inArray(postsTable.id, postIds));

  return { commentCount, prayCount };
}

/** Align `prayers_shared` / `prayed_for` with actual post + pray rows for seed users. */
export async function syncSeedUserEngagementStats(seedUserIds: number[]): Promise<void> {
  if (seedUserIds.length === 0) return;

  for (const userId of seedUserIds) {
    const [sharedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postsTable)
      .where(eq(postsTable.authorId, userId));
    const [prayedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postPrayersTable)
      .where(eq(postPrayersTable.userId, userId));

    await db
      .update(usersTable)
      .set({
        prayersShared: Number(sharedRow?.count ?? 0),
        prayedFor: Number(prayedRow?.count ?? 0),
      })
      .where(eq(usersTable.id, userId));
  }
}

export async function loadSeedPostsForUsers(seedUserIds: number[]): Promise<SeedPostRow[]> {
  if (seedUserIds.length === 0) return [];
  return db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .where(inArray(postsTable.authorId, seedUserIds));
}

export async function loadSeedUsers(seedUserIds: number[]): Promise<SeedUserRow[]> {
  if (seedUserIds.length === 0) return [];
  return db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(inArray(usersTable.id, seedUserIds));
}
