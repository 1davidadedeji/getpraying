/**
 * Production-safe seed: ~200 users with avatars, 4-12 posts each (~1000-2400 total),
 * real post_prayers + comments, and staggered timestamps spanning the last 90 days.
 *
 * Usage (from repo root or artifacts/api-server, with DATABASE_URL set):
 *   pnpm --filter @workspace/api-server run seed
 *   pnpm --filter @workspace/api-server run seed -- --force
 *   pnpm --filter @workspace/api-server run seed -- --refresh-engagement
 *
 * Emails use @seed.getpraying.app — re-run skips unless --force or --refresh-engagement.
 * Only touches users/posts/comments/post_prayers for @seed.getpraying.app accounts.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, usersTable, postsTable, commentsTable, postPrayersTable, savedPostsTable, pool } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  BATCH_SIZE,
  SEED_EMAIL_SUFFIX,
  SEED_PASSWORD,
  generatePostsForUser,
  generateUsers,
  type MockPost,
} from "./lib/seedSocialShared.ts";
import {
  loadSeedPostsForUsers,
  loadSeedUsers,
  seedEngagementForPosts,
  syncSeedUserEngagementStats,
  wipeEngagementForSeedPosts,
} from "./lib/seedPostEngagement.ts";

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
    await wipeEngagementForSeedPosts(postIds);
    await db.delete(savedPostsTable).where(inArray(savedPostsTable.postId, postIds));
  }
  await db.delete(postsTable).where(inArray(postsTable.authorId, userIds));
  await db.delete(commentsTable).where(inArray(commentsTable.authorId, userIds));
  await db.delete(postPrayersTable).where(inArray(postPrayersTable.userId, userIds));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  console.log(`[seed] Removed ${userIds.length} seed users and related posts/engagement.`);
}

function parseForce(): boolean {
  return process.argv.includes("--force");
}

function parseRefreshEngagement(): boolean {
  return process.argv.includes("--refresh-engagement");
}

async function refreshSeedEngagementOnly(seedUserIds: number[]): Promise<void> {
  const posts = await loadSeedPostsForUsers(seedUserIds);
  const seedUsers = await loadSeedUsers(seedUserIds);
  console.log(
    `[seed] Refreshing engagement on ${posts.length} seed posts (${seedUsers.length} seed users)…`,
  );
  const { commentCount, prayCount } = await seedEngagementForPosts(posts, seedUsers);
  await syncSeedUserEngagementStats(seedUserIds);
  console.log(`[seed] Created ${commentCount} comments and ${prayCount} post prayers (from real rows).`);
  console.log("[seed] Updated prayersShared / prayedFor from actual data.");
}

async function main(): Promise<void> {
  const force = parseForce();
  const refreshEngagement = parseRefreshEngagement();
  console.log("[seed] Starting GetPraying database seed…");

  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const existingIds = await getSeedUserIds();

  if (refreshEngagement && !force) {
    if (existingIds.length === 0) {
      console.log("[seed] No @seed.getpraying.app users found. Run full seed first.");
      await pool.end();
      process.exit(0);
    }
    await refreshSeedEngagementOnly(existingIds);
    console.log("[seed] Done (engagement refresh only).");
    await pool.end();
    return;
  }

  if (existingIds.length > 0 && !force) {
    console.log(
      `[seed] Seed data already exists (${existingIds.length} @seed.getpraying.app users).`,
    );
    console.log("[seed]   --force            replace all seed users/posts");
    console.log("[seed]   --refresh-engagement rebuild comments/prays on existing seed posts");
    await pool.end();
    process.exit(0);
  }

  if (force && existingIds.length > 0) {
    await wipeSeedData(existingIds);
  }

  const TARGET_USERS = 200;

  const mockUsers = generateUsers(TARGET_USERS);
  const mockPosts: MockPost[] = mockUsers.flatMap((u) =>
    generatePostsForUser(u.username, u.categories),
  );
  mockPosts.sort(() => Math.random() - 0.5);

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

  console.log(`[seed] Inserting ${mockPosts.length} posts (approved, pray_count starts at 0)…`);
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
          prayCount: 0,
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

  const seedUserIds = insertedUsers.map((u) => u.id);
  const posts = await loadSeedPostsForUsers(seedUserIds);
  const { commentCount, prayCount } = await seedEngagementForPosts(posts, insertedUsers);
  console.log(`[seed] Inserted ${commentCount} comments and ${prayCount} post prayers.`);

  await syncSeedUserEngagementStats(seedUserIds);

  console.log("[seed] Done.");
  console.log(`[seed]   ${insertedUsers.length} users (each with avatar)`);
  console.log(`[seed]   ${insertedPostIds.length} posts (4-12 per user, spread over 90 days)`);
  console.log(`[seed]   ${commentCount} comments (real rows in comments table)`);
  console.log(`[seed]   ${prayCount} post prayers (real rows in post_prayers table)`);
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
