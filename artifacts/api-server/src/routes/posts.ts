import { Router, type IRouter } from "express";
import { db, postsTable, postPrayersTable, savedPostsTable, usersTable, notificationsTable, commentsTable } from "@workspace/db";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPost, enrichPosts } from "../lib/postHelpers";
import { suggestCategory, suggestCategories } from "../lib/aiCategory";
import { moderatePost, aiRewrite } from "../lib/aiModeration";
import { RateLimiter } from "../lib/rateLimit";

const rewriteLimiter = new RateLimiter(30 * 60 * 1000, 3);

const router: IRouter = Router();

router.post("/posts/suggest-category", requireAuth, async (req, res): Promise<void> => {
  const { content } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  try {
    const categories = await suggestCategories(content);
    res.json({ category: categories[0] ?? null, categories });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to suggest category" });
  }
});

router.post("/posts/ai-rewrite", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { content } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const key = String(user.id);
  if (rewriteLimiter.remaining(key) <= 0) {
    res.status(429).json({ error: "You've used all rewrites for now. Try again in a bit." });
    return;
  }

  try {
    const rewritten = await aiRewrite(content);
    rewriteLimiter.tryHit(key);
    res.json({ rewritten });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "AI rewrite failed" });
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

router.get("/posts/new-count", optionalAuth, async (req, res): Promise<void> => {
  const sinceId = parseInt(req.query.sinceId as string, 10);
  if (!sinceId || Number.isNaN(sinceId)) {
    res.json({ count: 0 });
    return;
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postsTable)
    .where(and(eq(postsTable.status, "approved"), sql`${postsTable.id} > ${sinceId}`));
  res.json({ count: Math.min(Number(row?.count ?? 0), 99) });
});

router.get("/posts", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;
  const category = req.query.category as string | undefined;
  const currentUser = (req as any).user;

  let conditions: any = eq(postsTable.status, "approved");
  if (category) conditions = and(conditions, eq(postsTable.category, category));
  if (cursor) conditions = and(conditions, sql`${postsTable.id} < ${cursor}`);

  const posts = await db.select().from(postsTable).where(conditions)
    .orderBy(desc(postsTable.id)).limit(limit + 1);

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
  if (contentTrimmed.length > 5000) {
    res.status(400).json({ error: "Content must be under 5000 characters." });
    return;
  }
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

  // AI moderation pipeline (staff bypass)
  let postStatus: "approved" | "pending" | "declined" = "pending";
  let moderationReason: string | null = null;

  if (isStaff) {
    postStatus = "approved";
  } else if (storedContent && storedContent !== "(Image)") {
    const modResult = await moderatePost(storedContent);
    if (modResult.outcome === "approved") {
      postStatus = "approved";
    } else if (modResult.outcome === "rejected") {
      postStatus = "declined";
      moderationReason = modResult.reason;
    } else {
      postStatus = "pending";
      moderationReason = modResult.reason;
    }
  }

  if (postStatus === "declined") {
    res.status(400).json({ error: moderationReason ?? "Your post was not approved." });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      content: storedContent,
      mediaUrl: hasMedia ? mediaUrlStr : null,
      mediaType: storedMediaType,
      category: detectedCategory,
      isAnonymous: isAnonymous ?? false,
      status: postStatus,
      moderationReason,
      authorId: user.id,
    })
    .returning();

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

  const isAuthor = currentUser && post.authorId === currentUser.id;
  const isStaff = currentUser && (currentUser.role === "admin" || currentUser.role === "moderator");
  if (post.status !== "approved" && !isAuthor && !isStaff) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const enriched = await enrichPost(post, currentUser?.id);
  res.json(enriched);
});

const FLAG_THRESHOLD = 3;

router.post("/posts/:postId/flag", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const rawReason = (req.body ?? {}).reason;
  if (typeof rawReason !== "string" || !rawReason.trim()) {
    res.status(400).json({ error: "Reason is required" });
    return;
  }
  const reason = rawReason.trim();

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const currentUser = (req as any).user;
  if (post.authorId === currentUser.id) {
    res.status(400).json({ error: "You cannot flag your own post" });
    return;
  }

  const [updated] = await db
    .update(postsTable)
    .set({
      flagCount: sql`COALESCE(${postsTable.flagCount}, 0) + 1`,
      flagReason: post.flagReason ? sql`${postsTable.flagReason} || '; ' || ${reason}` : reason,
    })
    .where(eq(postsTable.id, postId))
    .returning();

  const shouldQueue = (updated.flagCount ?? 0) >= FLAG_THRESHOLD && post.status === "approved";
  if (shouldQueue) {
    await db.update(postsTable).set({ status: "pending" }).where(eq(postsTable.id, postId));
  }

  res.json({
    success: true,
    message: shouldQueue
      ? "Post reported and queued for moderator review."
      : "Report submitted. Thank you for helping keep the community safe.",
  });
});

router.get("/posts/:postId/comments", optionalAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  const currentUser = (req as any).user;
  const isAuthor = currentUser && post?.authorId === currentUser.id;
  const isStaff = currentUser && (currentUser.role === "admin" || currentUser.role === "moderator");
  if (!post || (post.status !== "approved" && !isAuthor && !isStaff)) {
    res.status(404).json({ error: "Post not found" });
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

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post || post.status !== "approved") {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const user = (req as any).user;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: "Comment must be under 2000 characters." });
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

  await db.delete(commentsTable).where(eq(commentsTable.postId, postId));
  await db.delete(postPrayersTable).where(eq(postPrayersTable.postId, postId));
  await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, postId));
  await db.delete(notificationsTable).where(eq(notificationsTable.postId, postId));
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

  if (post.status !== "approved") {
    res.status(403).json({ error: "This post is not available for interaction" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(postPrayersTable)
      .where(and(eq(postPrayersTable.postId, postId), eq(postPrayersTable.userId, user.id)));

    if (existing.length > 0) {
      const deleted = await tx
        .delete(postPrayersTable)
        .where(and(eq(postPrayersTable.postId, postId), eq(postPrayersTable.userId, user.id)))
        .returning({ id: postPrayersTable.id });
      if (deleted.length === 0) {
        const [p] = await tx.select({ prayCount: postsTable.prayCount }).from(postsTable).where(eq(postsTable.id, postId));
        return { prayCount: Number(p?.prayCount ?? 0), hasPrayed: false } as const;
      }
      const [updated] = await tx
        .update(postsTable)
        .set({ prayCount: sql`GREATEST(${postsTable.prayCount} - 1, 0)` })
        .where(eq(postsTable.id, postId))
        .returning();
      return { prayCount: updated.prayCount, hasPrayed: false } as const;
    } else {
      const inserted = await tx
        .insert(postPrayersTable)
        .values({ postId, userId: user.id })
        .onConflictDoNothing({ target: [postPrayersTable.postId, postPrayersTable.userId] })
        .returning({ id: postPrayersTable.id });
      if (inserted.length === 0) {
        const [p] = await tx.select({ prayCount: postsTable.prayCount }).from(postsTable).where(eq(postsTable.id, postId));
        return { prayCount: Number(p?.prayCount ?? 0), hasPrayed: true } as const;
      }
      const [updated] = await tx
        .update(postsTable)
        .set({ prayCount: sql`${postsTable.prayCount} + 1` })
        .where(eq(postsTable.id, postId))
        .returning();

      const newCount = updated.prayCount ?? 0;

      if (post.authorId && post.authorId !== user.id) {
        await tx
          .update(usersTable)
          .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
          .where(eq(usersTable.id, post.authorId));

        await tx.insert(notificationsTable).values({
          userId: post.authorId,
          type: "prayer",
          message: `prayed for your post`,
          actorId: user.id,
          postId,
          isRead: false,
        });

        if (PRAYER_MILESTONES.includes(newCount)) {
          await tx.insert(notificationsTable).values({
            userId: post.authorId,
            type: "prayer_milestone",
            message: `${newCount} people are now praying for your post! 🙌`,
            actorId: null,
            postId,
            isRead: false,
          });
        }
      }

      return { prayCount: newCount, hasPrayed: true } as const;
    }
  });

  res.json(result);
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

  if (post.status !== "approved") {
    res.status(403).json({ error: "This post is not available for interaction" });
    return;
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(savedPostsTable)
      .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));

    if (existing.length === 0) {
      const inserted = await tx
        .insert(savedPostsTable)
        .values({ postId, userId: user.id })
        .onConflictDoNothing({ target: [savedPostsTable.postId, savedPostsTable.userId] })
        .returning({ id: savedPostsTable.id });
      if (inserted.length === 0) return;

      await tx
        .update(usersTable)
        .set({ savedScrolls: sql`${usersTable.savedScrolls} + 1` })
        .where(eq(usersTable.id, user.id));

      if (post.authorId && post.authorId !== user.id) {
        await tx.insert(notificationsTable).values({
          userId: post.authorId,
          type: "saved",
          message: "Someone saved your prayer post to their library.",
          actorId: null,
          postId,
          isRead: false,
        });
      }
    }
  });

  res.json({ success: true, message: "Post saved" });
});

router.delete("/posts/:postId/save", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;

  const existing = await db
    .select()
    .from(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));

  if (existing.length > 0) {
    await db
      .delete(savedPostsTable)
      .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));

    await db
      .update(usersTable)
      .set({ savedScrolls: sql`GREATEST(${usersTable.savedScrolls} - 1, 0)` })
      .where(eq(usersTable.id, user.id));
  }

  res.json({ success: true, message: "Post unsaved" });
});

export default router;
