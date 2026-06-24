/**
 * One-off feed refresh: re-date existing seed posts + add users/posts to reach 2,000 approved.
 *
 * 1. Sets created_at on existing @seed.getpraying.app posts to random times in the last 14–30 days.
 * 2. Inserts new seed users (~90% white / ~10% minority mix) with USA city locations.
 * 3. Gives each new user exactly 4 approved posts with timestamps in the last 14 days.
 *
 * Usage (DATABASE_URL required):
 *   pnpm --filter @workspace/api-server run seed:feed-refresh
 *   pnpm --filter @workspace/api-server run seed:feed-refresh -- --dry-run
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, usersTable, postsTable, pool } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { generateDemographicUsers } from "./lib/seedFeedDemographics.ts";
import {
  BATCH_SIZE,
  SEED_EMAIL_SUFFIX,
  SEED_PASSWORD,
  generateFixedPostsForUser,
  randomTimestampDaysAgo,
} from "./lib/seedSocialShared.ts";
import {
  loadSeedPostsForUsers,
  seedEngagementForPosts,
  syncSeedUserEngagementStats,
} from "./lib/seedPostEngagement.ts";

const TARGET_TOTAL_POSTS = 2000;
const POSTS_PER_NEW_USER = 4;
const EXISTING_POST_MIN_DAYS = 14;
const EXISTING_POST_MAX_DAYS = 30;
const NEW_POST_MIN_DAYS = 0;
const NEW_POST_MAX_DAYS = 14;

function parseDryRun(): boolean {
  return process.argv.includes("--dry-run");
}

async function getSeedUserIds(): Promise<number[]> {
  const pattern = `%${SEED_EMAIL_SUFFIX}`;
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.email} LIKE ${pattern}`);
  return rows.map((r) => r.id);
}

async function countApprovedPosts(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(eq(postsTable.status, "approved"));
  return row?.count ?? 0;
}

async function loadReservedUsernames(): Promise<Set<string>> {
  const rows = await db.select({ username: usersTable.username }).from(usersTable);
  return new Set(rows.map((r) => r.username));
}

async function refreshExistingSeedPostDates(seedUserIds: number[], dryRun: boolean): Promise<number> {
  if (seedUserIds.length === 0) return 0;

  const postRows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(inArray(postsTable.authorId, seedUserIds), eq(postsTable.status, "approved")));

  if (postRows.length === 0) return 0;

  console.log(
    `[feed-refresh] ${dryRun ? "[dry-run] Would refresh" : "Refreshing"} ${postRows.length} existing seed post timestamps (${EXISTING_POST_MIN_DAYS}–${EXISTING_POST_MAX_DAYS} days ago)…`,
  );

  if (dryRun) return postRows.length;

  for (let i = 0; i < postRows.length; i += BATCH_SIZE) {
    const batch = postRows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((row) => {
        const createdAt = randomTimestampDaysAgo(EXISTING_POST_MIN_DAYS, EXISTING_POST_MAX_DAYS);
        return db
          .update(postsTable)
          .set({ createdAt, updatedAt: createdAt })
          .where(eq(postsTable.id, row.id));
      }),
    );
  }

  return postRows.length;
}

async function main(): Promise<void> {
  const dryRun = parseDryRun();
  console.log(`[feed-refresh] Starting social feed refresh${dryRun ? " (dry-run)" : ""}…`);

  if (!process.env.DATABASE_URL) {
    console.error("[feed-refresh] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const approvedBefore = await countApprovedPosts();
  const seedUserIds = await getSeedUserIds();
  console.log(`[feed-refresh] Approved posts now: ${approvedBefore}`);
  console.log(`[feed-refresh] Existing seed users: ${seedUserIds.length}`);

  const refreshed = await refreshExistingSeedPostDates(seedUserIds, dryRun);

  const approvedAfterRefresh = dryRun ? approvedBefore : await countApprovedPosts();
  const postsNeeded = Math.max(0, TARGET_TOTAL_POSTS - approvedAfterRefresh);
  const newUserCount = postsNeeded > 0 ? Math.ceil(postsNeeded / POSTS_PER_NEW_USER) : 0;
  const newPostCount = newUserCount * POSTS_PER_NEW_USER;

  console.log(`[feed-refresh] Target total: ${TARGET_TOTAL_POSTS}`);
  console.log(`[feed-refresh] New users to create: ${newUserCount} (${POSTS_PER_NEW_USER} posts each → ${newPostCount} posts)`);

  if (newUserCount === 0) {
    console.log("[feed-refresh] Already at or above target — date refresh only.");
    await pool.end();
    return;
  }

  const reservedUsernames = await loadReservedUsernames();
  const mockUsers = generateDemographicUsers(newUserCount, reservedUsernames);
  const mockPosts = mockUsers.flatMap((u) =>
    generateFixedPostsForUser(u.username, u.categories, POSTS_PER_NEW_USER, NEW_POST_MIN_DAYS, NEW_POST_MAX_DAYS),
  );

  const profileCounts = mockUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.profile] = (acc[u.profile] ?? 0) + 1;
    return acc;
  }, {});
  console.log("[feed-refresh] New user demographics:", profileCounts);

  if (dryRun) {
    console.log(`[feed-refresh] [dry-run] Would insert ${mockUsers.length} users and ${mockPosts.length} posts.`);
    await pool.end();
    return;
  }

  console.log("[feed-refresh] Hashing shared seed password…");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log(`[feed-refresh] Inserting ${mockUsers.length} users…`);
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
          location: u.location,
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
  console.log(`[feed-refresh] Inserting ${mockPosts.length} approved posts…`);

  let insertedPostCount = 0;
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
          updatedAt: p.createdAt,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (validBatch.length === 0) continue;

    const rows = await db.insert(postsTable).values(validBatch).returning({ id: postsTable.id });
    insertedPostCount += rows.length;
    insertedPostIds.push(...rows.map((r) => r.id));
  }

  if (insertedPostIds.length > 0) {
    const newPosts = await loadSeedPostsForUsers(insertedUsers.map((u) => u.id));
    const postsToSeed = newPosts.filter((p) => insertedPostIds.includes(p.id));
    const { commentCount, prayCount, saveCount } = await seedEngagementForPosts(postsToSeed, insertedUsers);
    console.log(
      `[feed-refresh] Seeded ${commentCount} comments, ${prayCount} post prayers, and ${saveCount} saves on new posts.`,
    );
  }

  const allSeedIds = await getSeedUserIds();
  await syncSeedUserEngagementStats(allSeedIds);

  const approvedFinal = await countApprovedPosts();
  console.log("[feed-refresh] Done.");
  console.log(`[feed-refresh]   Refreshed timestamps on ${refreshed} existing seed posts`);
  console.log(`[feed-refresh]   Added ${insertedUsers.length} users and ${insertedPostCount} posts`);
  console.log(`[feed-refresh]   Approved posts total: ${approvedFinal} (target ${TARGET_TOTAL_POSTS})`);
  console.log(`[feed-refresh] Seed accounts password: ${SEED_PASSWORD}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error("[feed-refresh] Failed:", err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
