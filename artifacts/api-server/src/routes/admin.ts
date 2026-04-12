import { Router, type IRouter } from "express";
import { db, postsTable, usersTable, postPrayersTable, notificationsTable } from "@workspace/db";
import { eq, ne, desc, sql, and, isNotNull, inArray, notLike } from "drizzle-orm";

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";
import { requireAdmin, requireModeratorOrAdmin } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

async function notifyAuthorPostDecision(
  authorId: number | null,
  postId: number,
  decision: "approved" | "declined",
  moderationReason?: string,
): Promise<void> {
  if (authorId == null) return;
  const message =
    decision === "approved"
      ? "Your prayer post was approved and is now visible in the feed."
      : `Your prayer post was not approved. Reason: ${(moderationReason ?? "").trim() || "No details provided."}`;
  await db.insert(notificationsTable).values({
    userId: authorId,
    type: decision === "approved" ? "post_approved" : "post_declined",
    message,
    postId,
    actorId: null,
  });
}

const router: IRouter = Router();

router.get("/admin/posts/pending", requireModeratorOrAdmin, async (req, res): Promise<void> => {
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

  // Exclude posts authored by seed accounts
  const seedUserIds = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.email} LIKE ${'%' + SEED_EMAIL_SUFFIX}`);
  const seedIds = seedUserIds.map((u) => u.id);

  let condition: any = ne(postsTable.status, "pending");
  if (seedIds.length > 0) {
    condition = and(condition, sql`${postsTable.authorId} NOT IN (${sql.join(seedIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(condition)
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

router.post("/admin/posts/:postId/approve", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const mod = (req as any).user;

  const [post] = await db
    .update(postsTable)
    .set({ status: "approved", moderatedByUserId: mod.id, moderationReason: null })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await notifyAuthorPostDecision(post.authorId ?? null, post.id, "approved");

  const [enriched] = await enrichPosts([post]);
  res.json(enriched);
});

router.post("/admin/posts/:postId/decline", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const mod = (req as any).user;

  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (reason.length < 3) {
    res.status(400).json({
      error: "A decline reason is required so the author can see it in their alerts (at least 3 characters).",
    });
    return;
  }

  const [post] = await db
    .update(postsTable)
    .set({
      status: "declined",
      moderatedByUserId: mod.id,
      moderationReason: reason,
    })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await notifyAuthorPostDecision(post.authorId ?? null, post.id, "declined", reason);

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

/** Return an approved post to the moderation queue (admin only). */
router.post("/admin/posts/:postId/requeue", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);

  const [post] = await db
    .update(postsTable)
    .set({ status: "pending", moderatedByUserId: null })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [enriched] = await enrichPosts([post]);
  res.json(enriched);
});

router.get("/admin/moderators/activity", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      moderatorId: postsTable.moderatedByUserId,
      actions: sql<number>`count(*)::int`,
    })
    .from(postsTable)
    .where(isNotNull(postsTable.moderatedByUserId))
    .groupBy(postsTable.moderatedByUserId);

  const ids = rows.map((r) => r.moderatorId).filter((id): id is number => id != null);
  if (ids.length === 0) {
    res.json({ moderators: [] });
    return;
  }

  const mods = await db.select().from(usersTable).where(inArray(usersTable.id, ids));

  const nameById = new Map(mods.map((u) => [u.id, u]));

  res.json({
    moderators: rows.map((r) => {
      const u = r.moderatorId != null ? nameById.get(r.moderatorId) : undefined;
      return {
        moderatorId: r.moderatorId,
        username: u?.username ?? null,
        displayName: u?.displayName ?? null,
        role: u?.role ?? null,
        actions: Number(r.actions ?? 0),
      };
    }),
  });
});

router.post("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);
  const adminUser = (req as any).user;
  const role = req.body?.role;

  const validRoles = ["user", "moderator", "admin"] as const;
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "role must be user, moderator, or admin" });
    return;
  }

  const typedRole = role as "user" | "moderator" | "admin";

  if (userId === adminUser.id && typedRole !== "admin") {
    res.status(400).json({ error: "You cannot remove your own admin access" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    await db.update(usersTable).set({ role: typedRole }).where(eq(usersTable.id, userId));
    res.json({ success: true, message: "Role updated", role: typedRole });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update role" });
  }
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "30", 10), 500);

  const users = await db
    .select()
    .from(usersTable)
    .where(notLike(usersTable.email, `%${SEED_EMAIL_SUFFIX}`))
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
