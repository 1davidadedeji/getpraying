import { Router, type IRouter } from "express";
import { db, postsTable, postPrayersTable, savedPostsTable, usersTable, notificationsTable, commentsTable } from "@workspace/db";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPost, enrichPosts } from "../lib/postHelpers";
import { suggestCategory, suggestCategories } from "../lib/aiCategory";

const router: IRouter = Router();

router.post("/posts/suggest-category", requireAuth, async (req, res): Promise<void> => {
  const { content } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  try {
    const categories = await suggestCategories(content);
    // Return both formats: primary category + full list
    res.json({ category: categories[0] ?? null, categories });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to suggest category" });
  }
});

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
  const personalize =
    req.query.personalize === "true" || req.query.personalize === "1" || req.query.personalize === "yes";
  const currentUser = (req as any).user;

  let conditions: any = eq(postsTable.status, "approved");
  if (category) {
    conditions = and(conditions, eq(postsTable.category, category));
  }

  if (
    personalize &&
    currentUser &&
    Array.isArray(currentUser.preferredCategories) &&
    currentUser.preferredCategories.length > 0
  ) {
    const prefs = currentUser.preferredCategories.filter((c: string) => typeof c === "string" && c.length > 0);
    if (prefs.length > 0) {
      conditions = and(conditions, inArray(postsTable.category, prefs));
    }
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

  const contentTrimmed = typeof content === "string" ? content.trim() : "";
  const mediaUrlStr = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
  const hasMedia = mediaUrlStr.length > 0;

  if (!contentTrimmed && !hasMedia) {
    res.status(400).json({ error: "Write something or attach an image." });
    return;
  }

  const storedContent = contentTrimmed || "(Image)";

  const rawMediaType =
    typeof mediaType === "string" ? mediaType.trim().toLowerCase() : null;
  const isStaff = user.role === "admin" || user.role === "moderator";
  let storedMediaType: string | null = null;
  if (hasMedia) {
    if (!isStaff) {
      if (rawMediaType === "video" || rawMediaType === "audio") {
        res.status(403).json({
          error: "Video and audio posts are only available to moderators and admins.",
        });
        return;
      }
      storedMediaType = "image";
    } else if (rawMediaType && ["image", "video", "audio"].includes(rawMediaType)) {
      storedMediaType = rawMediaType;
    } else {
      storedMediaType = "image";
    }
  }

  let detectedCategory: string | null = category ?? null;
  if (!detectedCategory) {
    try {
      detectedCategory = await suggestCategory(storedContent);
    } catch {
      detectedCategory = null;
    }
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      content: storedContent,
      mediaUrl: hasMedia ? mediaUrlStr : null,
      mediaType: storedMediaType,
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

router.get("/posts/:postId/comments", optionalAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const rows = await db
    .select({
      id: commentsTable.id,
      postId: commentsTable.postId,
      authorId: commentsTable.authorId,
      content: commentsTable.content,
      createdAt: commentsTable.createdAt,
      authorUsername: usersTable.username,
      authorDisplayName: usersTable.displayName,
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(usersTable.id, commentsTable.authorId))
    .where(eq(commentsTable.postId, postId))
    .orderBy(asc(commentsTable.createdAt));

  res.json({ comments: rows });
});

router.post("/posts/:postId/comments", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const user = (req as any).user;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const [created] = await db
    .insert(commentsTable)
    .values({ postId, authorId: user.id, content })
    .returning();

  const [author] = await db
    .select({ username: usersTable.username, displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  res.status(201).json({
    comment: {
      id: created.id,
      postId: created.postId,
      authorId: created.authorId,
      content: created.content,
      createdAt: created.createdAt,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
    },
  });
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

  if (post.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true, message: "Post deleted" });
});

// Prayer count milestones that trigger special notifications
const PRAYER_MILESTONES = [5, 10, 25, 50, 100, 250, 500];

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

    const newCount = updated.prayCount ?? 0;

    if (post.authorId && post.authorId !== user.id) {
      await db
        .update(usersTable)
        .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
        .where(eq(usersTable.id, post.authorId));

      // Individual pray notification
      await db.insert(notificationsTable).values({
        userId: post.authorId,
        type: "prayer",
        message: `prayed for your post`,
        actorId: user.id,
        postId,
        isRead: false,
      });

      // Milestone notifications (e.g., "10 people are now praying for your post!")
      if (PRAYER_MILESTONES.includes(newCount)) {
        await db.insert(notificationsTable).values({
          userId: post.authorId,
          type: "prayer_milestone",
          message: `${newCount} people are now praying for your post! 🙌`,
          actorId: null,
          postId,
          isRead: false,
        });
      }
    }

    res.json({ prayCount: newCount, hasPrayed: true });
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

    // Notify the post author that someone saved their post (don't reveal who)
    if (post.authorId && post.authorId !== user.id) {
      await db.insert(notificationsTable).values({
        userId: post.authorId,
        type: "saved",
        message: "Someone saved your prayer post to their library.",
        actorId: null, // intentionally null — saver remains anonymous
        postId,
        isRead: false,
      });
    }
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
