import { Router, type IRouter } from "express";
import { db, usersTable, postsTable, userFollowsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

const router: IRouter = Router();

router.get("/users/:username", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const username = raw;
  const viewer = (req as any).user as { id: number } | undefined;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
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

  const [target] = await db.select().from(usersTable).where(eq(usersTable.username, raw));
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
    await db.insert(notificationsTable).values({
      userId: target.id,
      type: "follow",
      message: "started following you",
      actorId: viewer.id,
      postId: null,
      isRead: false,
    });
  }

  res.json({ success: true, following: true });
});

router.delete("/users/:username/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const viewer = (req as any).user as { id: number };

  const [target] = await db.select().from(usersTable).where(eq(usersTable.username, raw));
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
  const username = raw;
  const currentUser = (req as any).user;

  const limit = parseInt((req.query.limit as string) || "20", 10);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
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

export default router;
