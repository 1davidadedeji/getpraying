import { Router, type IRouter } from "express";
import {
  db,
  postsTable,
  postPrayersTable,
  savedPostsTable,
  usersTable,
  notificationsTable,
  commentsTable,
  staffPostDeletionsTable,
} from "@workspace/db";
import { eq, and, or, desc, sql, asc } from "drizzle-orm";
import { filterAllowedCategories } from "../lib/categoriesAllowlist";
import { requireAuth, optionalAuth, userCanUsePremiumBoost } from "../lib/auth";
import { enrichPost, enrichPosts } from "../lib/postHelpers";
import { suggestCategory, suggestCategories } from "../lib/aiCategory";
import { moderatePost, aiRewrite } from "../lib/aiModeration";
import { notifyModeratorsNewPending } from "../lib/modQueueNotifications";
import { insertPostReport, userAlreadyReportedPost } from "../lib/postReports";
import { pushForNotificationById } from "../lib/pushForNotification";
import { RateLimiter } from "../lib/rateLimit";
import { decodeFeedCursor, encodeFeedCursor } from "../lib/feedCursor";
import { broadcastPushToRegisteredDevices } from "../lib/broadcastPush";

const rewriteLimiter = new RateLimiter(30 * 60 * 1000, 3);

/**
 * SQL expression for home feed ordering (newest first). Matches
 * `feedSortTimestampForCursor` in `feedCursor.ts` — boosted posts fall back to `created_at`
 * for viewers who already prayed, saved, or commented.
 */
function feedTimelineSortTsExpr(viewerId: number | undefined) {
  if (viewerId == null) {
    return sql`COALESCE(${postsTable.boostedAt}, ${postsTable.createdAt})`;
  }
  const engagedPrayed = sql`exists (
    select 1 from ${postPrayersTable}
    where ${and(eq(postPrayersTable.postId, postsTable.id), eq(postPrayersTable.userId, viewerId))}
  )`;
  const engagedSaved = sql`exists (
    select 1 from ${savedPostsTable}
    where ${and(eq(savedPostsTable.postId, postsTable.id), eq(savedPostsTable.userId, viewerId))}
  )`;
  const engagedCommented = sql`exists (
    select 1 from ${commentsTable}
    where ${and(eq(commentsTable.postId, postsTable.id), eq(commentsTable.authorId, viewerId))}
  )`;
  return sql`(
    case
      when ${postsTable.boostedAt} is not null
        and (${engagedPrayed} or ${engagedSaved} or ${engagedCommented})
      then ${postsTable.createdAt}
      else coalesce(${postsTable.boostedAt}, ${postsTable.createdAt})
    end
  )`;
}

const router: IRouter = Router();

async function getPostSaveState(
  postId: number,
  userId: number,
): Promise<{ saveCount: number; isSaved: boolean }> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedPostsTable)
    .where(eq(savedPostsTable.postId, postId));
  const [savedRow] = await db
    .select({ id: savedPostsTable.id })
    .from(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, userId)))
    .limit(1);
  return {
    saveCount: Number(countRow?.count ?? 0),
    isSaved: !!savedRow,
  };
}

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

/** Home feed “new prayers” pill: strictly `created_at > maxKnownCreatedAt` (`boosted_at` ignored). */
router.get("/posts/new-count", optionalAuth, async (req, res): Promise<void> => {
  const raw = req.query.maxKnownCreatedAt;
  if (typeof raw !== "string" || !raw.trim()) {
    res.json({ count: 0 });
    return;
  }
  const cutoff = new Date(raw.trim());
  if (Number.isNaN(cutoff.getTime())) {
    res.json({ count: 0 });
    return;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(and(eq(postsTable.status, "approved"), sql`${postsTable.createdAt} > ${cutoff}`));

  res.json({ count: Math.min(Number(row?.count ?? 0), 99) });
});

router.get("/posts", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);
  const cursorDecoded = decodeFeedCursor(req.query.cursor as string | undefined);
  const category = req.query.category as string | undefined;
  const currentUser = (req as any).user as { id: number } | undefined;
  const sortTs = feedTimelineSortTsExpr(currentUser?.id);

  let conditions: ReturnType<typeof eq> | ReturnType<typeof and> = eq(postsTable.status, "approved");
  if (category && String(category).trim()) {
    const c = String(category).trim();
    conditions = and(
      conditions,
      or(
        eq(postsTable.category, c),
        sql`coalesce(${postsTable.categoryTags}, '[]')::jsonb @> ${JSON.stringify([c])}::jsonb`,
      )!,
    )!;
  }
  if (cursorDecoded) {
    const kDate = new Date(cursorDecoded.k);
    conditions = and(
      conditions,
      or(sql`${sortTs} < ${kDate}`, sql`(${sortTs} = ${kDate} AND ${postsTable.id} < ${cursorDecoded.i})`)!,
    )!;
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(conditions)
    .orderBy(desc(sortTs), desc(postsTable.id))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const enriched = await enrichPosts(page, currentUser?.id);

  let nextCursor: string | null = null;
  if (hasMore && enriched.length > 0) {
    const last = enriched[enriched.length - 1]!;
    nextCursor = encodeFeedCursor(last);
  }

  res.json({
    posts: enriched,
    nextCursor,
    total: enriched.length,
  });
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { content, mediaUrl, mediaType, category, isAnonymous, categories: categoriesBody, applyBoost } = req.body;
  const wantsBoost = applyBoost === true;

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
    if (rawMediaType && ["image", "video", "audio"].includes(rawMediaType)) {
      storedMediaType = rawMediaType;
    } else {
      storedMediaType = "image";
    }
  }

  const rawTagOrder: string[] = [];
  if (typeof category === "string" && category.trim()) {
    rawTagOrder.push(category.trim().toLowerCase());
  }
  if (Array.isArray(categoriesBody)) {
    for (const c of categoriesBody) {
      if (typeof c === "string" && c.trim()) {
        const t = c.trim().toLowerCase();
        if (!rawTagOrder.includes(t)) rawTagOrder.push(t);
      }
    }
  }
  let tagList = filterAllowedCategories(rawTagOrder);
  if (tagList.length === 0) {
    let detected: string | null = null;
    try {
      detected = await suggestCategory(storedContent);
    } catch {
      detected = null;
    }
    if (detected) tagList = filterAllowedCategories([detected]);
  }
  const detectedCategory: string | null = tagList[0] ?? null;
  const categoryTagsJson: string | null = tagList.length > 0 ? JSON.stringify(tagList) : null;

  // AI moderation: text-only posts can be auto-approved/declined. Any media requires manual review (never auto-approved).
  let postStatus: "approved" | "pending" | "declined" = "pending";
  let moderationReason: string | null = null;

  if (isStaff) {
    postStatus = "approved";
  } else if (hasMedia) {
    postStatus = "pending";
    moderationReason = "Media requires manual review.";
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
      categoryTags: categoryTagsJson,
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

  if (postStatus === "pending") {
    await notifyModeratorsNewPending(post.id, user.id);
  }

  let postForResponse = post;
  if (
    wantsBoost &&
    postStatus === "approved" &&
    userCanUsePremiumBoost(user) &&
    post.boostedAt == null &&
    post.boostedByUserId == null
  ) {
    const now = new Date();
    const [boosted] = await db
      .update(postsTable)
      .set({ boostedAt: now, boostedByUserId: user.id, updatedAt: now })
      .where(and(eq(postsTable.id, post.id), sql`${postsTable.boostedAt} is null`))
      .returning();
    if (boosted) {
      postForResponse = boosted;

      let authorUsername: string | null = null;
      if (!boosted.isAnonymous && boosted.authorId != null) {
        const [a] = await db
          .select({ username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.id, boosted.authorId))
          .limit(1);
        authorUsername = a?.username ?? null;
      }

      const nameForPush = boosted.isAnonymous ? "Someone" : (authorUsername ?? "A member");
      const bodyPush = `A member needs help: ${nameForPush}`;

      void broadcastPushToRegisteredDevices({
        title: "Get Praying",
        body: bodyPush,
        data: {
          type: "boost_alert",
          postId: String(post.id),
          boostedByUserId: String(user.id),
        },
        excludeUserIds: new Set<number>([user.id]),
      });
    }
  }

  const enriched = await enrichPost(postForResponse, user.id);
  res.status(201).json(enriched);
});

router.post("/posts/:postId/boost", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  if (!userCanUsePremiumBoost(user)) {
    res.status(402).json({ error: "An active subscription is required.", code: "SUBSCRIPTION_REQUIRED" });
    return;
  }

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

  const now = new Date();

  // Same user taps again → clear boost (no push).
  if (post.boostedByUserId === user.id && post.boostedAt != null) {
    const [updated] = await db
      .update(postsTable)
      .set({ boostedAt: null, boostedByUserId: null, updatedAt: now })
      .where(eq(postsTable.id, postId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const enriched = await enrichPost(updated, user.id);
    res.json({ boostedAt: null, post: enriched });
    return;
  }

  const [updated] = await db
    .update(postsTable)
    .set({ boostedAt: now, boostedByUserId: user.id, updatedAt: now })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  let authorUsername: string | null = null;
  if (!updated.isAnonymous && updated.authorId != null) {
    const [a] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, updated.authorId))
      .limit(1);
    authorUsername = a?.username ?? null;
  }

  const nameForPush = updated.isAnonymous ? "Someone" : (authorUsername ?? "A member");
  const bodyPush = `A member needs help: ${nameForPush}`;

  void broadcastPushToRegisteredDevices({
    title: "Get Praying",
    body: bodyPush,
    data: {
      type: "boost_alert",
      postId: String(postId),
      boostedByUserId: String(user.id),
    },
    excludeUserIds: new Set<number>([user.id]),
  });

  const enriched = await enrichPost(updated, user.id);
  res.json({ boostedAt: now.toISOString(), post: enriched });
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

const FLAG_THRESHOLD = 1;

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

  if (await userAlreadyReportedPost(postId, currentUser.id)) {
    res.status(400).json({ error: "You already reported this prayer." });
    return;
  }

  const reportResult = await insertPostReport({
    postId,
    reporterId: currentUser.id,
    reason,
  });
  if (reportResult.duplicate) {
    res.status(400).json({ error: "You already reported this prayer." });
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

  if (post.authorId) {
    const [n] = await db
      .insert(notificationsTable)
      .values({
        userId: post.authorId,
        type: "post_reported",
        message: "Your prayer was reported. Our team will review it.",
        actorId: null,
        postId,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });
    if (n) void pushForNotificationById(n.id);
  }

  const shouldQueue = (updated.flagCount ?? 0) >= FLAG_THRESHOLD && post.status === "approved";
  if (shouldQueue) {
    await db.update(postsTable).set({ status: "pending" }).where(eq(postsTable.id, postId));
    if (post.authorId != null) {
      await notifyModeratorsNewPending(postId, post.authorId, {
        message: "A reported prayer needs moderation review.",
      });
    } else {
      await notifyModeratorsNewPending(postId, 0, {
        message: "A reported prayer needs moderation review.",
      });
    }
  } else if (post.status === "pending" && (updated.flagCount ?? 0) >= FLAG_THRESHOLD) {
    if (post.authorId != null) {
      await notifyModeratorsNewPending(postId, post.authorId, {
        message: "A reported prayer in the queue received another report.",
      });
    } else {
      await notifyModeratorsNewPending(postId, 0, {
        message: "A reported prayer in the queue received another report.",
      });
    }
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
      authorAvatarUrl: usersTable.avatarUrl,
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

  const result = await db.transaction(async (tx) => {
    const prior = await tx
      .select({ id: commentsTable.id })
      .from(commentsTable)
      .where(and(eq(commentsTable.postId, postId), eq(commentsTable.authorId, user.id)))
      .limit(1);
    const isFirstCommentFromUserOnPost = prior.length === 0;

    const priorPray = await tx
      .select({ id: postPrayersTable.id })
      .from(postPrayersTable)
      .where(and(eq(postPrayersTable.postId, postId), eq(postPrayersTable.userId, user.id)))
      .limit(1);
    const shouldBumpPrayedForComment = isFirstCommentFromUserOnPost && priorPray.length === 0;

    const [created] = await tx
      .insert(commentsTable)
      .values({ postId, authorId: user.id, content })
      .returning();

    let commentNotificationId: number | null = null;
    if (post.authorId && post.authorId !== user.id) {
      const [notif] = await tx
        .insert(notificationsTable)
        .values({
          userId: post.authorId,
          type: "comment",
          message: "commented on your prayer",
          actorId: user.id,
          postId,
          isRead: false,
        })
        .returning({ id: notificationsTable.id });
      commentNotificationId = notif?.id ?? null;

      if (shouldBumpPrayedForComment) {
        await tx
          .update(usersTable)
          .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
          .where(eq(usersTable.id, post.authorId));
      }
    }

    const [author] = await tx
      .select({
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return { created, author, commentNotificationId };
  });

  if (result.commentNotificationId != null) {
    void pushForNotificationById(result.commentNotificationId);
  }

  res.status(201).json({
    comment: {
      id: result.created.id,
      postId: result.created.postId,
      authorId: result.created.authorId,
      content: result.created.content,
      createdAt: result.created.createdAt,
      authorUsername: result.author?.username ?? null,
      authorDisplayName: result.author?.displayName ?? null,
      authorAvatarUrl: result.author?.avatarUrl ?? null,
    },
  });
});

router.delete("/posts/:postId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const user = (req as any).user;
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : String(req.query.reason ?? "").trim();

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const isStaff = user.role === "admin" || user.role === "moderator";
  if (post.authorId !== user.id && !isStaff) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const deletingOther =
    isStaff && post.authorId != null && post.authorId !== user.id;
  if (deletingOther) {
    if (reason.length < 3 || reason.length > 500) {
      res.status(400).json({
        error: "A reason of 3–500 characters is required to delete another person’s post.",
        code: "REASON_REQUIRED",
      });
      return;
    }
    await db.insert(staffPostDeletionsTable).values({
      postId: post.id,
      authorId: post.authorId!,
      staffUserId: user.id,
      reason,
      contentPreview: post.content.length > 280 ? post.content.slice(0, 277) + "…" : post.content,
    });
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
      const pushNotificationIds: number[] = [];

      if (post.authorId && post.authorId !== user.id) {
        const priorComments = await tx
          .select({ id: commentsTable.id })
          .from(commentsTable)
          .where(and(eq(commentsTable.postId, postId), eq(commentsTable.authorId, user.id)))
          .limit(1);
        if (priorComments.length === 0) {
          await tx
            .update(usersTable)
            .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
            .where(eq(usersTable.id, post.authorId));
        }

        const [nPray] = await tx
          .insert(notificationsTable)
          .values({
            userId: post.authorId,
            type: "prayer",
            message: `prayed for your post`,
            actorId: user.id,
            postId,
            isRead: false,
          })
          .returning({ id: notificationsTable.id });
        if (nPray) pushNotificationIds.push(nPray.id);

        if (PRAYER_MILESTONES.includes(newCount)) {
          const [nMil] = await tx
            .insert(notificationsTable)
            .values({
              userId: post.authorId,
              type: "prayer_milestone",
              message: `${newCount} people are now praying for your post! 🙌`,
              actorId: null,
              postId,
              isRead: false,
            })
            .returning({ id: notificationsTable.id });
          if (nMil) pushNotificationIds.push(nMil.id);
        }
      }

      return { prayCount: newCount, hasPrayed: true as const, pushNotificationIds };
    }
  });

  const pushPrayIds = (result as { pushNotificationIds?: number[] }).pushNotificationIds;
  if (Array.isArray(pushPrayIds)) {
    delete (result as { pushNotificationIds?: number[] }).pushNotificationIds;
    for (const id of pushPrayIds) void pushForNotificationById(id);
  }

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

  let savePushNotificationId: number | null = null;
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
        const [n] = await tx
          .insert(notificationsTable)
          .values({
            userId: post.authorId,
            type: "saved",
            message: "saved your prayer to their library.",
            actorId: user.id,
            postId,
            isRead: false,
          })
          .returning({ id: notificationsTable.id });
        savePushNotificationId = n?.id ?? null;
      }
    }
  });

  if (savePushNotificationId != null) void pushForNotificationById(savePushNotificationId);

  const state = await getPostSaveState(postId, user.id);
  res.json({ success: true, message: "Post saved", ...state });
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

  const state = await getPostSaveState(postId, user.id);
  res.json({ success: true, message: "Post unsaved", ...state });
});

export default router;
