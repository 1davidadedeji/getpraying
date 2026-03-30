import { Router, type IRouter } from "express";
import { db, postsTable, postPrayersTable, savedPostsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPost, enrichPosts } from "../lib/postHelpers";

const CATEGORIES = ["Anxiety", "Gratitude", "Healing", "Guidance", "Family", "Health", "Work/Career", "Finances", "Sleep", "Growth/Purpose", "Forgiveness", "Relationships", "Mental Health"];

function guessCategory(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.match(/anxiety|stress|worried|fear|overwhelm|panic/)) return "Anxiety";
  if (lower.match(/grateful|gratitude|thankful|bless/)) return "Gratitude";
  if (lower.match(/heal|sick|illness|surgery|hospital|health|recover/)) return "Healing";
  if (lower.match(/guide|guidance|path|direction|lost|clarity|purpose/)) return "Guidance";
  if (lower.match(/family|parent|child|marriage|spouse|wife|husband|son|daughter/)) return "Family";
  if (lower.match(/relationship|friend|love|lonely|connect/)) return "Relationships";
  if (lower.match(/work|job|career|finance|money|debt/)) return "Work/Career";
  if (lower.match(/sleep|rest|tired|exhausted/)) return "Sleep";
  if (lower.match(/mental|depression|grief|peace|calm/)) return "Mental Health";
  if (lower.match(/forgive|forgiveness|anger|resentment/)) return "Forgiveness";
  if (lower.match(/grow|purpose|meaning|goal/)) return "Growth/Purpose";
  return null;
}

const router: IRouter = Router();

router.get("/posts/stats", optionalAuth, async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "approved"));

  const prayersToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(postPrayersTable)
    .where(sql`${postPrayersTable.createdAt} >= ${today}`);

  const categoryRows = await db
    .select({ category: postsTable.category, count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "approved"))
    .groupBy(postsTable.category);

  const reflections = [
    "Be still, and know that I am God.",
    "The Lord is near to all who call on him.",
    "I can do all things through Christ who strengthens me.",
    "Cast your cares on the Lord and he will sustain you.",
    "Be anxious for nothing, but in everything by prayer.",
  ];
  const dailyReflection = reflections[new Date().getDay() % reflections.length];

  res.json({
    activePrayers: Number(totalResult[0]?.count ?? 0),
    prayersToday: Number(prayersToday[0]?.count ?? 0),
    byCategory: categoryRows
      .filter((r) => r.category != null)
      .map((r) => ({ category: r.category!, count: Number(r.count) })),
    dailyReflection,
  });
});

router.get("/posts/trending", optionalAuth, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "10", 10);
  const currentUser = (req as any).user;

  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.status, "approved"))
    .orderBy(desc(postsTable.prayCount))
    .limit(limit);

  const enriched = await enrichPosts(posts, currentUser?.id);
  res.json(enriched);
});

router.get("/posts", optionalAuth, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "20", 10);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;
  const category = req.query.category as string | undefined;
  const currentUser = (req as any).user;

  let conditions: any = eq(postsTable.status, "approved");
  if (category) {
    conditions = and(conditions, eq(postsTable.category, category));
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(conditions)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const enriched = await enrichPosts(page, currentUser?.id);

  res.json({
    posts: enriched,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    total: page.length,
  });
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { content, mediaUrl, mediaType, category, isAnonymous } = req.body;

  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const detectedCategory = category || guessCategory(content);

  const [post] = await db
    .insert(postsTable)
    .values({
      content,
      mediaUrl: mediaUrl ?? null,
      mediaType: mediaType ?? null,
      category: detectedCategory,
      isAnonymous: isAnonymous ?? false,
      status: "pending",
      authorId: user.id,
    })
    .returning();

  // Increment user prayers shared
  await db
    .update(usersTable)
    .set({ prayersShared: sql`${usersTable.prayersShared} + 1` })
    .where(eq(usersTable.id, user.id));

  const enriched = await enrichPost(post, user.id);
  res.status(201).json(enriched);
});

router.get("/posts/:postId", optionalAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const currentUser = (req as any).user;

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const enriched = await enrichPost(post, currentUser?.id);
  res.json(enriched);
});

router.delete("/posts/:postId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (post.authorId !== user.id && !user.isAdmin) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true, message: "Post deleted" });
});

router.post("/posts/:postId/pray", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const existing = await db
    .select()
    .from(postPrayersTable)
    .where(and(eq(postPrayersTable.postId, postId), eq(postPrayersTable.userId, user.id)));

  if (existing.length > 0) {
    // toggle off
    await db
      .delete(postPrayersTable)
      .where(and(eq(postPrayersTable.postId, postId), eq(postPrayersTable.userId, user.id)));
    const [updated] = await db
      .update(postsTable)
      .set({ prayCount: sql`${postsTable.prayCount} - 1` })
      .where(eq(postsTable.id, postId))
      .returning();
    res.json({ prayCount: updated.prayCount, hasPrayed: false });
  } else {
    await db.insert(postPrayersTable).values({ postId, userId: user.id });
    const [updated] = await db
      .update(postsTable)
      .set({ prayCount: sql`${postsTable.prayCount} + 1` })
      .where(eq(postsTable.id, postId))
      .returning();

    // Increment prayed_for for post author
    if (post.authorId && post.authorId !== user.id) {
      await db
        .update(usersTable)
        .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
        .where(eq(usersTable.id, post.authorId));

      // Create notification
      await db.insert(notificationsTable).values({
        userId: post.authorId,
        type: "prayer",
        message: `prayed for your post`,
        actorId: user.id,
        postId,
        isRead: false,
      });
    }

    res.json({ prayCount: updated.prayCount, hasPrayed: true });
  }
});

router.post("/posts/:postId/save", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const existing = await db
    .select()
    .from(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));

  if (existing.length === 0) {
    await db.insert(savedPostsTable).values({ postId, userId: user.id });
    await db
      .update(usersTable)
      .set({ savedScrolls: sql`${usersTable.savedScrolls} + 1` })
      .where(eq(usersTable.id, user.id));
  }

  res.json({ success: true, message: "Post saved" });
});

router.delete("/posts/:postId/save", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;

  await db
    .delete(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));

  await db
    .update(usersTable)
    .set({ savedScrolls: sql`${usersTable.savedScrolls} - 1` })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Post unsaved" });
});

export default router;
