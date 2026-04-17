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

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";
const SEED_PASSWORD = "GetPrayingSeed!2026";

const CATEGORIES = [
  "anxiety",
  "gratitude",
  "healing",
  "guidance",
  "relationships",
  "protection",
  "provision",
  "grief",
  "hope",
  "praise",
  "wisdom",
  "peace",
  "family",
  "health",
  "work/career",
  "finances",
  "sleep",
  "growth/purpose",
  "forgiveness",
  "mental health",
] as const;

type Category = (typeof CATEGORIES)[number];

// ─── Name banks ───────────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Sarah","Marcus","Emily","James","Olivia","David","Sophia","Noah","Abigail","Ethan",
  "Grace","Liam","Hannah","Daniel","Chloe","Matthew","Lily","Benjamin","Mia","Samuel",
  "Emma","Joshua","Ava","Caleb","Zoe","Andrew","Natalie","Isaac","Leah","Nathan",
  "Rachel","Luke","Rebecca","Aaron","Naomi","Elijah","Ruth","Timothy","Esther","Micah",
  "Lydia","Thomas","Anna","Peter","Hope","Stephen","Faith","Jonathan","Joy","Gabriel",
  "Miriam","Josiah","Priscilla","Isaiah","Martha","Adam","Eve","Joel","Tabitha","Seth",
  "Deborah","Ezra","Phoebe","Silas","Joanna","Paul","Mary","Philip","Diana","Mark",
  "Lois","Titus","Dorcas","Abel","Selah","Jude","Mercy","Jesse","Gloria","Gideon",
  "Angel","Asher","Bethany","Malachi","Charity","Micaiah","Patience","Levi","Serenity","Enoch",
  "Trinity","Cyrus","Harmony","Solomon","Eden","Elias","Felicity","Tobias","Haven","Judah",
] as const;

const LAST_INITIALS = "ABCDEFGHJKLMNPRSTUVWXYZ";

// ─── Prayer content templates (high quality, varied) ──────────────────────
const PRAYER_TEMPLATES: { template: string; category: Category }[] = [
  { category: "anxiety", template: "Please pray for calm as I face {situation}. My mind keeps racing, but I know God holds every moment." },
  { category: "anxiety", template: "Woke up with a heavy chest again. Pray that I can release this {situation} to the Lord today." },
  { category: "anxiety", template: "My {relation} is going through a tough time and I'm absorbing their stress. Pray for boundaries and peace." },
  { category: "anxiety", template: "I have a big {event} coming up and the worry is overwhelming. Pray I rest in God's sovereignty." },
  { category: "anxiety", template: "Can't sleep again. The what-ifs about {situation} won't stop. Pray for peace that surpasses understanding." },
  { category: "anxiety", template: "Panic attacks have returned after months of relief. Please pray for {situation} to calm and for God's hand over my mind." },
  { category: "anxiety", template: "Starting {event} tomorrow and I'm terrified. Please pray for courage and calm nerves." },

  { category: "gratitude", template: "Thankful that God provided exactly what we needed for {situation}. He is always on time." },
  { category: "gratitude", template: "Just got news about {situation} — God answered a prayer I've been praying for months. Praise Him!" },
  { category: "gratitude", template: "Small win today: {event}. Sounds insignificant but it felt like a gift straight from heaven." },
  { category: "gratitude", template: "My {relation} surprised me with the kindest gesture. God's love through people is so real." },
  { category: "gratitude", template: "Looking back over this year, I can count so many blessings despite the hard moments. God is good." },
  { category: "gratitude", template: "Grateful that {situation} worked out even better than I imagined. God's plans really are higher." },
  { category: "gratitude", template: "I woke up healthy, with a roof over my head and people who love me. That's enough to praise God all day." },

  { category: "healing", template: "Asking prayer for my {relation}'s recovery after {event}. The doctors are hopeful; we're asking for strength." },
  { category: "healing", template: "Chronic pain has been flaring up this week. Pray for relief and for the doctors to find {situation}." },
  { category: "healing", template: "My {relation} just received a difficult diagnosis. We're trusting God but it's scary. Please pray." },
  { category: "healing", template: "Post-surgery recovery is harder than expected. Pray for my {relation} to heal fully and find comfort." },
  { category: "healing", template: "Mental health has been a struggle lately. Pray for {situation} and for God to bring healing from the inside out." },
  { category: "healing", template: "My {relation} is fighting {situation} with everything they have. Please storm heaven on their behalf." },
  { category: "healing", template: "Dealing with burnout at {event}. Pray for rest and restoration — body, mind, and spirit." },

  { category: "guidance", template: "I need wisdom about whether to {situation}. I want to follow where God leads, not my own understanding." },
  { category: "guidance", template: "At a crossroads with {situation}. Both paths seem good but I only want God's best. Please pray for clarity." },
  { category: "guidance", template: "Deciding whether to {situation}. I don't want to disappoint anyone, but I need to follow God's voice." },
  { category: "guidance", template: "My {relation} is asking me for advice about {situation} and I want to point them to God, not just my opinion." },
  { category: "guidance", template: "Praying about {event} — I feel a pull but I'm not sure if it's from God or from fear. Pray for discernment." },
  { category: "guidance", template: "Starting something new with {situation} and I need wisdom every step of the way." },
  { category: "guidance", template: "God, show me where you want me. I'm willing to go. Community, please pray I hear clearly." },

  { category: "relationships", template: "Pray for patience and kindness between my {relation} and me. We love each other but stress has made us short." },
  { category: "relationships", template: "A friendship I valued is falling apart over {situation}. Pray for reconciliation or grace to let go." },
  { category: "relationships", template: "Pray for reconciliation in our family before {event}. So much old hurt — only God can soften hearts." },
  { category: "relationships", template: "My {relation} and I disagree on {situation}. Pray we can talk without arguing and find common ground." },
  { category: "relationships", template: "I've been lonely lately. Pray that God brings community and genuine friendships into my life." },
  { category: "relationships", template: "Forgiving my {relation} for {situation} is the hardest thing I've ever done. Pray for my heart." },
  { category: "relationships", template: "Pray my {relation} and I can rebuild trust after {situation}. It won't be easy but God can do anything." },

  { category: "protection", template: "Our city experienced {event} last night. Pray for families affected and for first responders." },
  { category: "protection", template: "My {relation} is traveling through a dangerous area for {situation}. Please pray for safety." },
  { category: "protection", template: "Pray for protection over my children as they navigate {situation}. This world is so broken." },
  { category: "protection", template: "There's been unrest in our neighborhood. Pray for God's covering over every family here." },
  { category: "protection", template: "Starting a new {event} in an unfamiliar place. Pray for safety and for God to go before me." },

  { category: "provision", template: "Bills are tight this month because of {situation}. Please pray for provision and no shame in asking for help." },
  { category: "provision", template: "Lost my job unexpectedly due to {situation}. Trusting God but the fear is real. Pray for open doors." },
  { category: "provision", template: "Our {relation}'s medical expenses are piling up. Pray God provides in ways we can't imagine." },
  { category: "provision", template: "Need a reliable car to get to {event}. Seems small but it's everything to me right now. Please pray." },
  { category: "provision", template: "Praying for provision for {situation}. God has always come through — I'm choosing to trust again." },
  { category: "provision", template: "Food pantry visit today — no shame, just gratitude. Pray for continued provision and a path forward." },

  { category: "grief", template: "First {event} without my {relation}. If you've walked this road, please pray I can breathe through the waves." },
  { category: "grief", template: "It's been a year since we lost {relation} and some days the grief hits fresh. Pray for comfort today." },
  { category: "grief", template: "Grieving {situation} and people keep saying 'be strong.' I just need to be held by God right now." },
  { category: "grief", template: "My {relation} passed away suddenly. Nothing prepares you. Please just pray — I don't even have words." },
  { category: "grief", template: "Grief comes in waves. Today's wave is big. Pray I don't drown in sadness but float on God's faithfulness." },

  { category: "hope", template: "Feeling discouraged about {situation}. Asking God to renew my hope and remind me He's still working." },
  { category: "hope", template: "Small win today: {event}. Thank you for praying — please keep praying for joy to return in fuller measure." },
  { category: "hope", template: "After months of darkness, I saw a glimmer of hope in {situation}. God is faithful even in the waiting." },
  { category: "hope", template: "Pray I don't give up on {situation}. It's been so long, but I know God's timing is perfect." },
  { category: "hope", template: "I'm choosing hope today even though {situation} hasn't changed. Sometimes faith is just showing up." },

  { category: "praise", template: "Baptism Sunday was beautiful. Thank you, Jesus, for rescuing me. Pray I stay rooted and humble." },
  { category: "praise", template: "God turned {situation} around completely. What was meant for harm, He used for good. All glory to Him!" },
  { category: "praise", template: "My {relation} gave their life to Christ this week! Years of prayer answered. God is so good." },
  { category: "praise", template: "Just want to praise God today — not because {situation} is perfect, but because He is." },
  { category: "praise", template: "Testimony time: God healed my {relation} from {situation}. The doctors said it was remarkable. We say it was God." },
  { category: "praise", template: "Praise report! {event} went better than we could have dreamed. Only God could do this." },

  { category: "wisdom", template: "Leading a team at work and facing {situation}. Need discernment to speak truth with grace." },
  { category: "wisdom", template: "Raising teenagers is no joke. Pray for wisdom with {situation} — I want to guide, not control." },
  { category: "wisdom", template: "Making a financial decision about {situation}. Pray I choose wisely and not out of fear." },
  { category: "wisdom", template: "Studying God's Word on {situation} and asking the Holy Spirit to illuminate what I need to see." },
  { category: "wisdom", template: "Being asked to speak on {situation} at church. Pray for the right words at the right time." },
  { category: "wisdom", template: "Navigating a complicated {situation} at work. Need Solomon-level wisdom. Please pray." },

  { category: "peace", template: "Night anxiety is back. Pray I can cast these thoughts on the Lord and actually sleep." },
  { category: "peace", template: "My mind won't stop replaying {situation}. Pray for the peace that passes understanding." },
  { category: "peace", template: "The news is overwhelming. Pray I can engage without losing my peace in God's sovereignty." },
  { category: "peace", template: "In the middle of conflict about {situation}. Pray I can be a peacemaker, not a peacekeeper." },
  { category: "peace", template: "Pray for peace in my home — {situation} has everyone on edge. We need God's calm." },
  { category: "peace", template: "I'm at war with myself over {situation}. Pray I surrender to God and find stillness." },

  { category: "family", template: "Pray for our marriage as we navigate {situation}. We want to love each other the way Christ loves the church." },
  { category: "family", template: "Our kids are struggling with {situation}. Pray for patience for us and peace for them." },
  { category: "family", template: "Single parent here — asking God for strength with {situation} and wisdom for every conversation." },
  { category: "family", template: "Pray for my {relation} and me to reconnect after tension over {situation}. Family is worth fighting for." },
  { category: "family", template: "Blended family dynamics around {event} are exhausting. Pray we choose grace over grudges." },
  { category: "family", template: "Pray for my aging {relation} as they face {situation}. I want to honor them well." },
  { category: "family", template: "Hoping to grow our family through adoption. Pray through {situation} and for the children God may place with us." },

  { category: "health", template: "Waiting on {event} for {situation}. Pray for good news and steady nerves." },
  { category: "health", template: "Managing a chronic condition alongside {situation}. Pray for endurance and wise care." },
  { category: "health", template: "My {relation}'s health has declined. Pray for healing, comfort, and the right medical team." },
  { category: "health", template: "Trying to build better habits around sleep, food, and movement while juggling {situation}. Pray for discipline." },
  { category: "health", template: "Recovery from {event} is slower than I hoped. Pray my body responds and I don't lose heart." },
  { category: "health", template: "Wellness feels out of reach with {situation} on my plate. Pray I can take small faithful steps." },
  { category: "health", template: "Pray for protection from illness in our home before {event} — we can't afford to be sidelined." },

  { category: "work/career", template: "Feeling stuck in my career with {situation}. Pray God opens a door or reshapes my heart where I am." },
  { category: "work/career", template: "Starting {event} at a new job. Pray I learn fast, build trust, and keep my integrity." },
  { category: "work/career", template: "Workplace conflict over {situation} is draining. Pray for wisdom and a path toward peace." },
  { category: "work/career", template: "Considering a pivot because of {situation}. Pray for clarity between ambition and calling." },
  { category: "work/career", template: "My {relation} was laid off. Pray for provision and for the right next role." },
  { category: "work/career", template: "Leading through {situation} at work — I need courage to speak up and humility to listen." },
  { category: "work/career", template: "Burnout is real with {situation}. Pray I set boundaries without fear and trust God with outcomes." },

  { category: "finances", template: "Debt from {situation} feels crushing. Pray for a plan, extra income, and freedom from shame." },
  { category: "finances", template: "Pray for faithful stewardship as we decide about {situation} — we want to honor God with every dollar." },
  { category: "finances", template: "Unexpected bills after {event}. Pray for provision and for peace while we sort it out." },
  { category: "finances", template: "Supporting my {relation} through {situation} has stretched our budget. Pray God multiplies what we have." },
  { category: "finances", template: "Pray for wisdom about giving, saving, and spending while facing {situation}." },
  { category: "finances", template: "Housing costs and {situation} don't add up on paper. Pray God makes a way we can't see yet." },
  { category: "finances", template: "Thankful for a small breakthrough with {situation}. Pray we stay generous and grounded." },

  { category: "sleep", template: "Insomnia again — my mind replays {situation}. Pray I can cast it on God and actually rest." },
  { category: "sleep", template: "Nightmares and anxiety after {event}. Pray for peaceful nights and restored sleep." },
  { category: "sleep", template: "Shift work is destroying my sleep rhythm with {situation}. Pray for protection and recovery." },
  { category: "sleep", template: "Pray I stop scrolling and surrender {situation} to God so my body can wind down." },
  { category: "sleep", template: "Little ones waking all night plus {situation} — I'm running on fumes. Pray for strength and sleep when I can get it." },
  { category: "sleep", template: "Asking for calm evenings before {event} so I can sleep without dread." },
  { category: "sleep", template: "Pray for deep, restorative rest; {situation} has left me wired and exhausted at the same time." },

  { category: "growth/purpose", template: "Feeling directionless with {situation}. Pray God shows me the next faithful step." },
  { category: "growth/purpose", template: "Want to go deeper spiritually but {situation} keeps crowding out time with God. Pray for hunger and rhythm." },
  { category: "growth/purpose", template: "Pray I discover how my gifts fit into {situation} for God's glory, not just my résumé." },
  { category: "growth/purpose", template: "After {event}, I'm asking who God made me to be. Pray for clarity and courage." },
  { category: "growth/purpose", template: "Discipleship with my {relation} around {situation} — pray we both grow in truth and love." },
  { category: "growth/purpose", template: "Pray I stop comparing my path to others and trust God's purpose in {situation}." },
  { category: "growth/purpose", template: "Serving in {situation} feels mundane. Pray God renews my sense of mission." },

  { category: "forgiveness", template: "Struggling to forgive my {relation} for {situation}. Pray God softens my heart without excusing harm." },
  { category: "forgiveness", template: "I need to seek forgiveness after {situation}. Pray for humility and the right words." },
  { category: "forgiveness", template: "Old resentment from {event} keeps resurfacing. Pray I release it to God again and again." },
  { category: "forgiveness", template: "Pray I can forgive myself for {situation} and receive God's mercy as real." },
  { category: "forgiveness", template: "Church hurt around {situation} is hard to untangle. Pray for healing and honest reconciliation where possible." },
  { category: "forgiveness", template: "My {relation} asked for forgiveness after {situation}. Pray I respond with wisdom and grace." },
  { category: "forgiveness", template: "Pray for freedom from bitterness about {situation} — I don't want it to define my future." },

  { category: "mental health", template: "Depression has been heavy with {situation}. Pray for light, for good care, and for people who show up." },
  { category: "mental health", template: "Starting therapy for {situation}. Pray it's a safe space and that God works through it." },
  { category: "mental health", template: "Managing anxiety and depression alongside {situation} — not the same as everyday worry. Pray for steady ground." },
  { category: "mental health", template: "Medication adjustments after {event} have been rough. Pray for stability and patience with the process." },
  { category: "mental health", template: "Pray for my {relation} facing {situation} — they deserve compassion, not judgment." },
  { category: "mental health", template: "Isolation is feeding dark thoughts about {situation}. Pray I reach out and accept help." },
  { category: "mental health", template: "Grief and low mood after {situation} won't lift overnight. Pray I keep choosing hope one day at a time." },
];

const SITUATIONS = [
  "test results","a career change","our finances","my health","my family","a move",
  "school decisions","a difficult conversation","church leadership","ministry direction",
  "a legal matter","a broken relationship","starting over","my kids' futures",
  "a toxic work environment","a prodigal child","housing","immigration paperwork",
  "wedding planning","deployment","infertility","adoption process","my commute",
  "college applications","starting a business","retirement planning","a custody battle",
  "chronic illness","a faith crisis","re-entering the workforce","eldercare for parents",
  "debt repayment","graduate school","a broken engagement","church discipline",
];

const EVENTS = [
  "a job interview","surgery","the holidays","a court date","a move",
  "the school year","a mission trip","a church retreat","a family reunion",
  "a performance review","finals week","a medical appointment","the birth of our baby",
  "a funeral","a wedding","graduation","a road trip","a new semester",
  "a conference","vacation","a marathon","a community service event",
  "camp","a worship night","Bible study kickoff","a leadership meeting",
];

const RELATIONS = [
  "mom","dad","sister","brother","spouse","son","daughter","best friend",
  "grandmother","grandfather","uncle","aunt","cousin","pastor","mentor",
  "neighbor","coworker","roommate","niece","nephew","in-laws","fiancé",
];

const COMMENT_TEMPLATES = [
  "Praying for you right now. God sees every tear.",
  "Lifting you up. You are not alone in this.",
  "I've been through something similar. It gets better. Praying!",
  "The Lord is near to the brokenhearted. Praying for comfort.",
  "Standing with you in prayer. God is faithful.",
  "God hears you. He hasn't forgotten. Praying.",
  "Praying for peace that passes understanding for you tonight.",
  "You're in my prayers today and every day.",
  "What a beautiful testimony! All glory to God.",
  "So happy for you! God is so good.",
  "Thank you for sharing this. Praying with you.",
  "Amen! God's timing is always perfect.",
  "Claiming this in Jesus' name. Prayers going up!",
  "Holding space for you in prayer. You're loved.",
  "God is close to the brokenhearted. Praying comfort for you.",
  "Praying God provides exactly what you need.",
  "What a beautiful reminder of God's faithfulness. Praying!",
  "You've got this one step at a time. Praying clarity for you.",
  "The waiting is hard but God is working even now. Praying!",
  "Romans 8:28. Praying everything works together for good.",
  "Isaiah 41:10. Don't fear, God is with you. Praying!",
  "Philippians 4:6-7. Giving this to God in prayer.",
  "Praying for supernatural peace and strength over you.",
  "God's grace is sufficient. Praying you feel it today.",
  "So encouraged by your faith. Praying alongside you!",
  "Psalm 46:10. Be still and know. Praying for you.",
  "This brought tears to my eyes. Praying from the bottom of my heart.",
  "Your vulnerability blesses us all. Praying fervently.",
  "God will make a way. Praying for open doors.",
  "Jeremiah 29:11. God has plans for you. Praying!",
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fillTemplate(tpl: string): string {
  return tpl
    .replace(/\{situation\}/g, pick(SITUATIONS))
    .replace(/\{event\}/g, pick(EVENTS))
    .replace(/\{relation\}/g, pick(RELATIONS));
}

interface MockUser {
  username: string;
  localPart: string;
  displayName: string;
  categories: string[];
  avatarUrl: string;
}

function generateUsers(count: number): MockUser[] {
  const used = new Set<string>();
  const users: MockUser[] = [];

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastInit = LAST_INITIALS[i % LAST_INITIALS.length];
    const suffix = i >= FIRST_NAMES.length ? `${Math.floor(i / FIRST_NAMES.length)}` : "";

    const username = `${first.toLowerCase()}_${lastInit.toLowerCase()}${suffix}`;
    if (used.has(username)) continue;
    used.add(username);

    const portraitIndex = i % 100;
    const gender = i % 2 === 0 ? "women" : "men";
    const avatarUrl = `https://randomuser.me/api/portraits/${gender}/${portraitIndex}.jpg`;

    users.push({
      username,
      localPart: `${first.toLowerCase()}.${lastInit.toLowerCase()}${suffix}`,
      displayName: `${first} ${lastInit}.`,
      categories: pickN(CATEGORIES as unknown as string[], randInt(2, 4)) as string[],
      avatarUrl,
    });
  }

  return users;
}

interface MockPost {
  authorUsername: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  prayCount: number;
  createdAt: Date;
}

function generatePostsForUser(username: string, preferredCategories: string[]): MockPost[] {
  const postCount = randInt(4, 12);
  const posts: MockPost[] = [];

  for (let i = 0; i < postCount; i++) {
    let tpl;
    if (Math.random() < 0.6 && preferredCategories.length > 0) {
      const cat = pick(preferredCategories);
      const matching = PRAYER_TEMPLATES.filter((t) => t.category === cat);
      tpl = matching.length > 0 ? pick(matching) : pick(PRAYER_TEMPLATES);
    } else {
      tpl = pick(PRAYER_TEMPLATES);
    }

    const daysAgo = randInt(0, 90);
    const hoursAgo = randInt(0, 23);
    const minutesAgo = randInt(0, 59);
    const createdAt = new Date(
      Date.now() - daysAgo * 86_400_000 - hoursAgo * 3_600_000 - minutesAgo * 60_000,
    );

    posts.push({
      authorUsername: username,
      content: fillTemplate(tpl.template),
      category: tpl.category,
      isAnonymous: Math.random() < 0.08,
      prayCount: randInt(0, 60),
      createdAt,
    });
  }

  return posts;
}

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

const BATCH_SIZE = 50;

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
