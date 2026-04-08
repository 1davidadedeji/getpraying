import { Router, type IRouter } from "express";
import { db, postsTable, usersTable, postPrayersTable } from "@workspace/db";
import { eq, ne, desc, sql, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

const router: IRouter = Router();

router.get("/admin/posts/pending", requireAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "20", 10);

  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.status, "pending"))
    .orderBy(postsTable.createdAt)
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const enriched = await enrichPosts(page);

  res.json({
    posts: enriched,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    total: page.length,
  });
});

router.get("/admin/posts/moderated", requireAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "20", 10);

  const posts = await db
    .select()
    .from(postsTable)
    .where(ne(postsTable.status, "pending"))
    .orderBy(desc(postsTable.updatedAt))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const enriched = await enrichPosts(page);

  res.json({
    posts: enriched,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    total: page.length,
  });
});

router.post("/admin/posts/:postId/approve", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);

  const [post] = await db
    .update(postsTable)
    .set({ status: "approved" })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [enriched] = await enrichPosts([post]);
  res.json(enriched);
});

router.post("/admin/posts/:postId/decline", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);

  const [post] = await db
    .update(postsTable)
    .set({ status: "declined" })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [enriched] = await enrichPosts([post]);
  res.json(enriched);
});

router.delete("/admin/posts/:postId/remove", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.delete(postPrayersTable).where(eq(postPrayersTable.postId, postId));
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true, message: "Post removed" });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "30", 10);

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit + 1);

  const hasMore = users.length > limit;
  const page = users.slice(0, limit);

  res.json({
    users: page.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      role: u.role,
      isBanned: u.isBanned,
      trialStartsAt: u.trialStartsAt,
      isEmailVerified: u.isEmailVerified,
      preferredCategories: u.preferredCategories,
      onboardingComplete: u.onboardingComplete,
      prayersShared: u.prayersShared,
      prayedFor: u.prayedFor,
      savedScrolls: u.savedScrolls,
      createdAt: u.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    total: page.length,
  });
});

router.post("/admin/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);

  const [user] = await db
    .update(usersTable)
    .set({ isBanned: true })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true, message: "User banned" });
});

router.post("/admin/users/:userId/unban", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);

  const [user] = await db
    .update(usersTable)
    .set({ isBanned: false })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true, message: "User unbanned" });
});

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [bannedUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.isBanned, true));
  const [totalPosts] = await db.select({ count: sql<number>`count(*)` }).from(postsTable);
  const [pendingPosts] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "pending"));
  const [approvedPosts] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "approved"));
  const [declinedPosts] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "declined"));
  const [prayersToday] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postPrayersTable)
    .where(sql`${postPrayersTable.createdAt} >= ${today}`);

  res.json({
    totalUsers: Number(totalUsers?.count ?? 0),
    activeUsers: Number(totalUsers?.count ?? 0) - Number(bannedUsers?.count ?? 0),
    totalPosts: Number(totalPosts?.count ?? 0),
    pendingPosts: Number(pendingPosts?.count ?? 0),
    approvedPosts: Number(approvedPosts?.count ?? 0),
    declinedPosts: Number(declinedPosts?.count ?? 0),
    bannedUsers: Number(bannedUsers?.count ?? 0),
    prayersToday: Number(prayersToday?.count ?? 0),
  });
});

export default router;
