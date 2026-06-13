/**
 * Production-safe seed: ~200 users with avatars, 4-12 posts each (~1000-2400 total),
 * comments, and staggered timestamps spanning the last 90 days.
 *
 * Usage (from repo root or artifacts/api-server, with DATABASE_URL set):
 *   pnpm --filter @workspace/api-server run seed
 *   pnpm --filter @workspace/api-server run seed -- --force
 *
 * Emails use @seed.getpraying.app — re-run skips unless --force (wipes seed data first).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, usersTable, postsTable, commentsTable, pool } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  BATCH_SIZE,
  COMMENT_TEMPLATES,
  SEED_EMAIL_SUFFIX,
  SEED_PASSWORD,
  generatePostsForUser,
  generateUsers,
  pick,
  pickN,
  randInt,
  type MockPost,
} from "./lib/seedSocialShared.ts";

// ─── DB operations ────────────────────────────────────────────────────────

async function getSeedUserIds(): Promise<number[]> {
  const pattern = `%${SEED_EMAIL_SUFFIX}`;
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.email} LIKE ${pattern}`);
  return rows.map((r) => r.id);
}

async function wipeSeedData(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  const postRows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(inArray(postsTable.authorId, userIds));
  const postIds = postRows.map((p) => p.id);
  if (postIds.length > 0) {
    await db.delete(commentsTable).where(inArray(commentsTable.postId, postIds));
  }
  await db.delete(postsTable).where(inArray(postsTable.authorId, userIds));
  await db.delete(commentsTable).where(inArray(commentsTable.authorId, userIds));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  console.log(`[seed] Removed ${userIds.length} seed users and related posts/comments.`);
}

function parseForce(): boolean {
  return process.argv.includes("--force");
}

async function main(): Promise<void> {
  const force = parseForce();
  console.log("[seed] Starting GetPraying database seed…");

  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const existingIds = await getSeedUserIds();
  if (existingIds.length > 0 && !force) {
    console.log(
      `[seed] Seed data already exists (${existingIds.length} @seed.getpraying.app users). Use --force to replace.`,
    );
    await pool.end();
    process.exit(0);
  }

  if (force && existingIds.length > 0) {
    await wipeSeedData(existingIds);
  }

  // ── Generate data ──────────────────────────────────────────────────────
  const TARGET_USERS = 200;

  const mockUsers = generateUsers(TARGET_USERS);
  const mockPosts: MockPost[] = mockUsers.flatMap((u) =>
    generatePostsForUser(u.username, u.categories),
  );
  mockPosts.sort(() => Math.random() - 0.5);

  // ── Insert users ───────────────────────────────────────────────────────
  console.log(`[seed] Hashing shared password (bcrypt cost 10)…`);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log(`[seed] Inserting ${mockUsers.length} users…`);
  const insertedUsers: { id: number; username: string }[] = [];

  for (let i = 0; i < mockUsers.length; i += BATCH_SIZE) {
    const batch = mockUsers.slice(i, i + BATCH_SIZE);
    const rows = await db
      .insert(usersTable)
      .values(
        batch.map((u) => ({
          email: `${u.localPart}${SEED_EMAIL_SUFFIX}`,
          username: u.username,
          displayName: u.displayName,
          bio: null,
          avatarUrl: u.avatarUrl,
          passwordHash,
          role: "user" as const,
          isBanned: false,
          isEmailVerified: true,
          verificationToken: null,
          verificationExpiresAt: null,
          preferredCategories: u.categories,
          onboardingComplete: true,
          trialStartsAt: new Date(),
        })),
      )
      .returning({ id: usersTable.id, username: usersTable.username });
    insertedUsers.push(...rows);
  }

  const userIdByUsername = new Map(insertedUsers.map((r) => [r.username, r.id]));
  console.log(`[seed] Created ${insertedUsers.length} users.`);

  // ── Insert posts ───────────────────────────────────────────────────────
  console.log(`[seed] Inserting ${mockPosts.length} posts (approved)…`);
  const insertedPostIds: number[] = [];

  for (let i = 0; i < mockPosts.length; i += BATCH_SIZE) {
    const batch = mockPosts.slice(i, i + BATCH_SIZE);
    const validBatch = batch
      .map((p) => {
        const authorId = userIdByUsername.get(p.authorUsername);
        if (authorId == null) return null;
        return {
          content: p.content,
          category: p.category,
          isAnonymous: p.isAnonymous,
          status: "approved" as const,
          authorId,
          prayCount: p.prayCount,
          createdAt: p.createdAt,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (validBatch.length === 0) continue;

    const rows = await db
      .insert(postsTable)
      .values(validBatch)
      .returning({ id: postsTable.id });
    insertedPostIds.push(...rows.map((r) => r.id));
  }

  console.log(`[seed] Created ${insertedPostIds.length} posts.`);

  // ── Insert comments (roughly 1-3 per post, ~60% of posts get comments)
  console.log("[seed] Inserting comments…");
  let commentCount = 0;
  const commentValues: { postId: number; authorId: number; content: string }[] = [];

  for (const postId of insertedPostIds) {
    if (Math.random() > 0.6) continue;
    const numComments = randInt(1, 3);
    const commenters = pickN(insertedUsers, numComments);
    for (const commenter of commenters) {
      commentValues.push({
        postId,
        authorId: commenter.id,
        content: pick(COMMENT_TEMPLATES),
      });
    }
  }

  for (let i = 0; i < commentValues.length; i += BATCH_SIZE) {
    const batch = commentValues.slice(i, i + BATCH_SIZE);
    await db.insert(commentsTable).values(batch);
    commentCount += batch.length;
  }

  console.log(`[seed] Created ${commentCount} comments.`);

  // ── Update user prayer counts ──────────────────────────────────────────
  console.log("[seed] Updating prayer counts on users…");
  const postCountByUser = new Map<string, number>();
  for (const p of mockPosts) {
    postCountByUser.set(p.authorUsername, (postCountByUser.get(p.authorUsername) ?? 0) + 1);
  }
  for (const [username, count] of postCountByUser) {
    const uid = userIdByUsername.get(username);
    if (uid == null) continue;
    await db.update(usersTable).set({ prayersShared: count }).where(eq(usersTable.id, uid));
  }

  // Update prayedFor counts randomly
  console.log("[seed] Updating prayedFor counts on users…");
  for (const u of insertedUsers) {
    const prayedFor = randInt(5, 180);
    await db.update(usersTable).set({ prayedFor }).where(eq(usersTable.id, u.id));
  }

  console.log("[seed] Done.");
  console.log(`[seed]   ${insertedUsers.length} users (each with avatar)`);
  console.log(`[seed]   ${insertedPostIds.length} posts (4-12 per user, spread over 90 days)`);
  console.log(`[seed]   ${commentCount} comments`);
  console.log(`[seed] All seed accounts use password: ${SEED_PASSWORD}`);
  console.log("[seed] Remove these users before public launch if using shared credentials.");

  await pool.end();
}

main().catch(async (err) => {
  console.error("[seed] Failed:", err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
