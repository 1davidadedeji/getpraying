/**
 * Production-safe seed: mock users, approved prayer posts, and comments.
 *
 * Usage (from repo root or artifacts/api-server, with DATABASE_URL set):
 *   pnpm --filter @workspace/api-server run seed
 *   pnpm --filter @workspace/api-server run seed -- --force
 *
 * Emails use @seed.getpraying.app — re-run skips unless --force (wipes seed users + their posts/comments).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, usersTable, postsTable, commentsTable, pool } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";
const SEED_PASSWORD = "GetPrayingSeed!2026";

const MOCK_USERS = [
  {
    username: "sarah_j",
    localPart: "sarah.j",
    displayName: "Sarah J.",
    bio: "Mom of two, learning to trust God one day at a time.",
    categories: ["anxiety", "gratitude", "peace"] as string[],
  },
  {
    username: "marcus_t",
    localPart: "marcus.t",
    displayName: "Marcus T.",
    bio: "Serving at our local church; here to pray with you.",
    categories: ["guidance", "praise", "relationships"] as string[],
  },
  {
    username: "emily_r",
    localPart: "emily.r",
    displayName: "Emily R.",
    bio: "Nurse. Grateful for every answered prayer.",
    categories: ["healing", "hope", "grief"] as string[],
  },
  {
    username: "james_k",
    localPart: "james.k",
    displayName: "James K.",
    bio: "Teacher. Asking God for wisdom daily.",
    categories: ["wisdom", "provision", "protection"] as string[],
  },
  {
    username: "olivia_m",
    localPart: "olivia.m",
    displayName: "Olivia M.",
    bio: "Walking through grief with faith.",
    categories: ["grief", "hope", "peace"] as string[],
  },
  {
    username: "david_h",
    localPart: "david.h",
    displayName: "David H.",
    bio: "Husband and father. God is faithful.",
    categories: ["relationships", "provision", "gratitude"] as string[],
  },
  {
    username: "sophia_l",
    localPart: "sophia.l",
    displayName: "Sophia L.",
    bio: "College student — seeking direction.",
    categories: ["guidance", "anxiety", "peace"] as string[],
  },
  {
    username: "noah_p",
    localPart: "noah.p",
    displayName: "Noah P.",
    bio: "Here to encourage others on the journey.",
    categories: ["praise", "hope", "healing"] as string[],
  },
] as const;

const MOCK_POSTS: {
  authorUsername: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  prayCount?: number;
}[] = [
  {
    authorUsername: "sarah_j",
    category: "anxiety",
    isAnonymous: false,
    prayCount: 12,
    content:
      "Please pray for calm as I wait on test results. I know God holds tomorrow, but my mind keeps racing tonight.",
  },
  {
    authorUsername: "marcus_t",
    category: "gratitude",
    isAnonymous: false,
    prayCount: 8,
    content:
      "Thankful our small group made it through a hard year. God provided when we didn’t see a way. Praise Him.",
  },
  {
    authorUsername: "emily_r",
    category: "healing",
    isAnonymous: false,
    prayCount: 15,
    content:
      "Asking prayer for my mom’s recovery after surgery. The doctors are hopeful; we’re asking for strength and peace for our whole family.",
  },
  {
    authorUsername: "james_k",
    category: "guidance",
    isAnonymous: false,
    prayCount: 5,
    content:
      "I need wisdom about whether to take a new job offer. I want to provide for my family without losing what matters most.",
  },
  {
    authorUsername: "olivia_m",
    category: "grief",
    isAnonymous: true,
    prayCount: 20,
    content:
      "First holidays without my sister. If you’ve walked this road, please pray I can breathe through the waves of sadness.",
  },
  {
    authorUsername: "david_h",
    category: "relationships",
    isAnonymous: false,
    prayCount: 6,
    content:
      "Pray for patience and kindness between my wife and me. We love each other but stress has made us short with one another.",
  },
  {
    authorUsername: "sophia_l",
    category: "guidance",
    isAnonymous: false,
    prayCount: 4,
    content:
      "Deciding whether to change my major. I don’t want to disappoint anyone, but I want to follow where God leads.",
  },
  {
    authorUsername: "noah_p",
    category: "praise",
    isAnonymous: false,
    prayCount: 9,
    content:
      "Baptism Sunday was beautiful. Thank you, Jesus, for rescuing me. Pray I stay rooted and humble.",
  },
  {
    authorUsername: "sarah_j",
    category: "peace",
    isAnonymous: false,
    prayCount: 7,
    content:
      "Night anxiety is back. Pray I can cast these thoughts on the Lord and actually sleep.",
  },
  {
    authorUsername: "marcus_t",
    category: "protection",
    isAnonymous: false,
    prayCount: 11,
    content:
      "Our city had storms last night. Pray for families still without power and for first responders.",
  },
  {
    authorUsername: "emily_r",
    category: "hope",
    isAnonymous: false,
    prayCount: 3,
    content:
      "Feeling discouraged about a friendship that drifted. Asking God to heal what’s broken or give me grace to let go.",
  },
  {
    authorUsername: "james_k",
    category: "provision",
    isAnonymous: false,
    prayCount: 14,
    content:
      "Bills are tight this month. We’re cutting what we can. Please pray for provision and no shame in asking for help.",
  },
  {
    authorUsername: "olivia_m",
    category: "hope",
    isAnonymous: false,
    prayCount: 6,
    content:
      "Small win today: I laughed with a friend. Thank you for praying — please keep praying for joy to return in fuller measure.",
  },
  {
    authorUsername: "david_h",
    category: "wisdom",
    isAnonymous: false,
    prayCount: 5,
    content:
      "Leading a team at work and facing a conflict I didn’t cause. Need discernment to speak truth with grace.",
  },
  {
    authorUsername: "sophia_l",
    category: "anxiety",
    isAnonymous: true,
    prayCount: 8,
    content:
      "Finals week. I’m overwhelmed. Pray I remember my worth isn’t my GPA.",
  },
  {
    authorUsername: "noah_p",
    category: "healing",
    isAnonymous: false,
    prayCount: 4,
    content:
      "Friend struggling with addiction agreed to try a recovery group. Pray for courage on the hard nights ahead.",
  },
  {
    authorUsername: "marcus_t",
    category: "relationships",
    isAnonymous: false,
    prayCount: 10,
    content:
      "Pray for reconciliation in our extended family before the reunion. So much old hurt — only God can soften hearts.",
  },
  {
    authorUsername: "sarah_j",
    category: "gratitude",
    isAnonymous: false,
    prayCount: 16,
    content:
      "Kids slept through the night for the first time in weeks. Sounds small but it felt like a gift straight from heaven.",
  },
];

/** commentText, post index (into inserted posts order), authorUsername */
const MOCK_COMMENTS: { postIndex: number; authorUsername: string; content: string }[] = [
  {
    postIndex: 0,
    authorUsername: "marcus_t",
    content: "Praying for peace that passes understanding for you tonight, Sarah.",
  },
  {
    postIndex: 0,
    authorUsername: "emily_r",
    content: "Waiting is so hard. You’re not alone — lifting you up.",
  },
  {
    postIndex: 2,
    authorUsername: "sarah_j",
    content: "Praying for your mom’s healing and for rest for you as you support her.",
  },
  {
    postIndex: 4,
    authorUsername: "olivia_m",
    content: "The first holidays hurt in ways words can’t fix. Holding space for you in prayer.",
  },
  {
    postIndex: 4,
    authorUsername: "noah_p",
    content: "God is close to the brokenhearted. Praying comfort for you.",
  },
  {
    postIndex: 7,
    authorUsername: "david_h",
    content: "What a beautiful testimony. So happy for you, brother.",
  },
  {
    postIndex: 11,
    authorUsername: "marcus_t",
    content: "Praying God provides exactly what you need — and community to walk beside you.",
  },
  {
    postIndex: 14,
    authorUsername: "james_k",
    content: "You’ve got this one step at a time. Praying clarity and calm for your meeting.",
  },
];

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
  const postRows = await db.select({ id: postsTable.id }).from(postsTable).where(inArray(postsTable.authorId, userIds));
  const postIds = postRows.map((p) => p.id);
  if (postIds.length > 0) {
    await db.delete(commentsTable).where(inArray(commentsTable.postId, postIds));
  }
  await db.delete(postsTable).where(inArray(postsTable.authorId, userIds));
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
    console.log("[seed] Seed data already exists (@seed.getpraying.app users). Use --force to replace.");
    await pool.end();
    process.exit(0);
  }

  if (force && existingIds.length > 0) {
    await wipeSeedData(existingIds);
  }

  console.log("[seed] Hashing shared seed password (bcrypt cost 10)…");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("[seed] Inserting mock users…");
  const insertedUsers: { id: number; username: string }[] = [];
  for (const u of MOCK_USERS) {
    const email = `${u.localPart}${SEED_EMAIL_SUFFIX}`;
    const [row] = await db
      .insert(usersTable)
      .values({
        email,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        passwordHash,
        role: "user",
        isBanned: false,
        isEmailVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
        preferredCategories: [...u.categories],
        onboardingComplete: true,
        trialStartsAt: new Date(),
      })
      .returning({ id: usersTable.id, username: usersTable.username });
    if (row) insertedUsers.push(row);
  }

  const userIdByUsername = new Map(insertedUsers.map((r) => [r.username, r.id]));
  console.log(`[seed] Created ${insertedUsers.length} users.`);

  console.log("[seed] Inserting prayer posts (approved)…");
  const insertedPostIds: number[] = [];
  for (const p of MOCK_POSTS) {
    const authorId = userIdByUsername.get(p.authorUsername);
    if (authorId == null) {
      console.warn(`[seed] Skip post — unknown author ${p.authorUsername}`);
      continue;
    }
    const [post] = await db
      .insert(postsTable)
      .values({
        content: p.content,
        category: p.category,
        isAnonymous: p.isAnonymous,
        status: "approved",
        authorId,
        prayCount: p.prayCount ?? 0,
      })
      .returning({ id: postsTable.id });
    if (post) insertedPostIds.push(post.id);
  }
  console.log(`[seed] Created ${insertedPostIds.length} posts.`);

  console.log("[seed] Inserting comments…");
  let commentCount = 0;
  for (const c of MOCK_COMMENTS) {
    const postId = insertedPostIds[c.postIndex];
    const authorId = userIdByUsername.get(c.authorUsername);
    if (postId == null || authorId == null) continue;
    await db.insert(commentsTable).values({
      postId,
      authorId,
      content: c.content,
    });
    commentCount += 1;
  }
  console.log(`[seed] Created ${commentCount} comments.`);

  console.log("[seed] Updating prayer counts on users…");
  for (const u of MOCK_USERS) {
    const uid = userIdByUsername.get(u.username);
    if (uid == null) continue;
    const n = MOCK_POSTS.filter((p) => p.authorUsername === u.username).length;
    await db.update(usersTable).set({ prayersShared: n }).where(eq(usersTable.id, uid));
  }

  console.log("[seed] Done.");
  console.log(`[seed] All seed accounts use password: ${SEED_PASSWORD}`);
  console.log("[seed] Change or remove these users before public launch if you use shared credentials.");

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
