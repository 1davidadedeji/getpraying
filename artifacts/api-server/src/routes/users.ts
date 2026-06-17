import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  postsTable,
  userFollowsTable,
  notificationsTable,
  postPrayersTable,
  commentsTable,
  savedPostsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";
import { findUserByUsername } from "../lib/userLookup";
import { pushForNotificationById } from "../lib/pushForNotification";

const router: IRouter = Router();

async function fetchLikedPostsForUser(
  userId: number,
  viewerId: number | undefined,
  limit: number,
) {
  const cap = Math.min(Math.max(limit, 1), 100);
  const prays = await db
    .select({ postId: postPrayersTable.postId })
    .from(postPrayersTable)
    .where(eq(postPrayersTable.userId, userId))
    .orderBy(desc(postPrayersTable.createdAt))
    .limit(cap);

  if (prays.length === 0) return [];

  const postIds = prays.map((r) => r.postId);
  const posts = await db
    .select()
    .from(postsTable)
    .where(and(inArray(postsTable.id, postIds), eq(postsTable.status, "approved")));
  const enriched = await enrichPosts(posts, viewerId);
  const idOrder = new Map(postIds.map((id, i) => [id, i]));
  enriched.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  return enriched;
}

async function fetchSavedPostsForUser(
  userId: number,
  viewerId: number | undefined,
  limit: number,
) {
  const cap = Math.min(Math.max(limit, 1), 100);
  const savedRows = await db
    .select()
    .from(savedPostsTable)
    .where(eq(savedPostsTable.userId, userId))
    .orderBy(desc(savedPostsTable.createdAt))
    .limit(cap);

  if (savedRows.length === 0) return [];

  const postIds = savedRows.map((r) => r.postId);
  const posts = await db
    .select()
    .from(postsTable)
    .where(and(inArray(postsTable.id, postIds), eq(postsTable.status, "approved")));
  const enriched = await enrichPosts(posts, viewerId);
  const idOrder = new Map(postIds.map((id, i) => [id, i]));
  enriched.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  return enriched;
}

async function fetchCommentedPostsForUser(
  userId: number,
  viewerId: number | undefined,
  limit: number,
) {
  const cap = Math.min(Math.max(limit, 1), 100);
  const comments = await db
    .select({ postId: commentsTable.postId })
    .from(commentsTable)
    .where(eq(commentsTable.authorId, userId))
    .orderBy(desc(commentsTable.createdAt))
    .limit(cap);

  if (comments.length === 0) return [];

  const seen = new Set<number>();
  const postIds: number[] = [];
  for (const c of comments) {
    if (!seen.has(c.postId)) {
      seen.add(c.postId);
      postIds.push(c.postId);
    }
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(and(inArray(postsTable.id, postIds), eq(postsTable.status, "approved")));
  const enriched = await enrichPosts(posts, viewerId);
  const idOrder = new Map(postIds.map((id, i) => [id, i]));
  enriched.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  return enriched;
}

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user as { id: number };
  const { location, displayName, scheduledNotificationsEnabled, timezone } = req.body ?? {};
  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };

  if (typeof location === "string") {
    updates.location = location.trim().slice(0, 100) || null;
  }
  if (typeof displayName === "string") {
    updates.displayName = displayName.trim().slice(0, 60) || null;
  }
  if (typeof scheduledNotificationsEnabled === "boolean") {
    updates.scheduledNotificationsEnabled = scheduledNotificationsEnabled;
  }
  if (typeof timezone === "string" && timezone.trim().length > 0) {
    updates.timezone = timezone.trim().slice(0, 64);
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    location: updated.location ?? null,
    avatarUrl: updated.avatarUrl,
  });
});

router.post("/users/me/push-token", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user as { id: number };
  const raw = req.body?.token;
  if (raw !== null && raw !== undefined && typeof raw !== "string") {
    res.status(400).json({ error: "token must be a string or null" });
    return;
  }
  const token =
    raw === null || raw === undefined ? null : String(raw).trim() === "" ? null : String(raw).trim();

  if (token != null && !token.startsWith("ExponentPushToken[")) {
    res.status(400).json({ error: "Invalid Expo push token format" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = { expoPushToken: token, updatedAt: new Date() };
  const tz = req.body?.timezone;
  if (typeof tz === "string" && tz.trim().length > 0) {
    updates.timezone = tz.trim().slice(0, 64);
  }

  if (token != null) {
    await db
      .update(usersTable)
      .set({ expoPushToken: null, updatedAt: new Date() })
      .where(and(eq(usersTable.expoPushToken, token), ne(usersTable.id, user.id)));
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
  res.json({ success: true });
});

/** Posts the signed-in user has prayed for (liked) — registered before /users/:username/*. */
router.get("/users/me/liked-posts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user as { id: number };
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const posts = await fetchLikedPostsForUser(user.id, user.id, limit);
  res.json({ posts });
});

/** Posts the signed-in user has commented on */
router.get("/users/me/commented-posts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user as { id: number };
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const posts = await fetchCommentedPostsForUser(user.id, user.id, limit);
  res.json({ posts });
});

router.get("/users/:username", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const username = typeof raw === "string" ? raw.trim() : "";
  const viewer = (req as any).user as { id: number } | undefined;

  if (!username) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = await findUserByUsername(username);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [followersRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(userFollowsTable)
    .where(eq(userFollowsTable.followingId, user.id));
  const [followingRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(userFollowsTable)
    .where(eq(userFollowsTable.followerId, user.id));

  let isFollowing: boolean | undefined;
  if (viewer && viewer.id !== user.id) {
    const [row] = await db
      .select({ id: userFollowsTable.id })
      .from(userFollowsTable)
      .where(and(eq(userFollowsTable.followerId, viewer.id), eq(userFollowsTable.followingId, user.id)))
      .limit(1);
    isFollowing = !!row;
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: null,
    location: user.location ?? null,
    avatarUrl: user.avatarUrl,
    prayersShared: user.prayersShared,
    prayedFor: user.prayedFor,
    savedScrolls: user.savedScrolls,
    createdAt: user.createdAt,
    followerCount: Number(followersRow?.c ?? 0),
    followingCount: Number(followingRow?.c ?? 0),
    ...(isFollowing !== undefined ? { isFollowing } : {}),
  });
});

router.post("/users/:username/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const viewer = (req as any).user as { id: number };

  const target = await findUserByUsername(typeof raw === "string" ? raw : "");
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.id === viewer.id) {
    res.status(400).json({ error: "You cannot follow yourself" });
    return;
  }

  const inserted = await db
    .insert(userFollowsTable)
    .values({ followerId: viewer.id, followingId: target.id })
    .onConflictDoNothing({ target: [userFollowsTable.followerId, userFollowsTable.followingId] })
    .returning({ id: userFollowsTable.id });

  if (inserted.length > 0) {
    const [n] = await db
      .insert(notificationsTable)
      .values({
        userId: target.id,
        type: "follow",
        message: "started following you",
        actorId: viewer.id,
        postId: null,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });
    if (n) void pushForNotificationById(n.id);
  }

  res.json({ success: true, following: true });
});

router.delete("/users/:username/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const viewer = (req as any).user as { id: number };

  const target = await findUserByUsername(typeof raw === "string" ? raw : "");
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .delete(userFollowsTable)
    .where(and(eq(userFollowsTable.followerId, viewer.id), eq(userFollowsTable.followingId, target.id)));

  res.json({ success: true, following: false });
});

router.get("/users/:username/posts", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const username = typeof raw === "string" ? raw.trim() : "";
  const currentUser = (req as any).user;

  const limit = parseInt((req.query.limit as string) || "20", 10);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

  if (!username) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = await findUserByUsername(username);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let conditions: any = and(
    eq(postsTable.authorId, user.id),
    eq(postsTable.status, "approved"),
  );

  if (cursor) {
    conditions = and(conditions, sql`${postsTable.id} < ${cursor}`);
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

router.get("/users/:username/liked-posts", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const viewer = (req as any).user as { id: number } | undefined;

  const user = await findUserByUsername(typeof raw === "string" ? raw : "");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const posts = await fetchLikedPostsForUser(user.id, viewer?.id, limit);
  res.json({ posts });
});

router.get("/users/:username/commented-posts", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const viewer = (req as any).user as { id: number } | undefined;

  const user = await findUserByUsername(typeof raw === "string" ? raw : "");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const posts = await fetchCommentedPostsForUser(user.id, viewer?.id, limit);
  res.json({ posts });
});

/** Public saved feed posts for a user (approved only), most-recently-saved first. */
router.get("/users/:username/saved-posts", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const viewer = (req as any).user as { id: number } | undefined;

  const user = await findUserByUsername(typeof raw === "string" ? raw : "");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const posts = await fetchSavedPostsForUser(user.id, viewer?.id, limit);
  res.json({ posts });
});

export default router;
