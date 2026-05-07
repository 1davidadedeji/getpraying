import { Router, type IRouter } from "express";
import {
  db,
  postsTable,
  usersTable,
  postPrayersTable,
  notificationsTable,
  commentsTable,
  savedPostsTable,
  officialPrayersTable,
  savedOfficialPrayersTable,
  prayerPathsTable,
  sessionsTable,
  userFollowsTable,
} from "@workspace/db";
import { eq, ne, desc, sql, and, or, isNotNull, isNull, inArray, notLike } from "drizzle-orm";

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";
import { requireAdmin, requireModeratorOrAdmin } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";
import { clearModQueueNotificationsForPost, notifyModeratorsNewPending } from "../lib/modQueueNotifications";
import { officialGuideTextError } from "../lib/officialGuideTextLimits";
import { pushForNotificationById } from "../lib/pushForNotification";

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
  const [n] = await db
    .insert(notificationsTable)
    .values({
      userId: authorId,
      type: decision === "approved" ? "post_approved" : "post_declined",
      message,
      postId,
      actorId: null,
      isRead: false,
    })
    .returning({ id: notificationsTable.id });
  if (n) void pushForNotificationById(n.id);
}

const router: IRouter = Router();

router.get("/admin/pending-count", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(eq(postsTable.status, "pending"));
  res.json({ count: result[0]?.count ?? 0 });
});

router.get("/admin/posts/pending", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "20", 10);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

  let conditions: any = eq(postsTable.status, "pending");
  if (cursor) conditions = and(conditions, sql`${postsTable.id} < ${cursor}`);

  const posts = await db
    .select()
    .from(postsTable)
    .where(conditions)
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
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

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
  if (cursor) condition = and(condition, sql`${postsTable.id} < ${cursor}`);

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
    .set({ status: "approved", moderatedByUserId: mod.id, moderationReason: null, flagReason: null })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await clearModQueueNotificationsForPost(postId);
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

  await clearModQueueNotificationsForPost(postId);
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

  await db.delete(commentsTable).where(eq(commentsTable.postId, postId));
  await db.delete(postPrayersTable).where(eq(postPrayersTable.postId, postId));
  await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, postId));
  await db.delete(notificationsTable).where(eq(notificationsTable.postId, postId));
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

  await notifyModeratorsNewPending(postId, post.authorId ?? 0);

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
    const roleLabel =
      typedRole === "admin" ? "an admin" : typedRole === "moderator" ? "a moderator" : "a member";
    const [n] = await db
      .insert(notificationsTable)
      .values({
        userId,
        type: "role_updated",
        message: `Your account role was updated — you are now ${roleLabel}.`,
        actorId: adminUser.id,
        postId: null,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });
    if (n) void pushForNotificationById(n.id);
    res.json({ success: true, message: "Role updated", role: typedRole });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update role" });
  }
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || "30", 10), 500);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

  let userCondition: any = notLike(usersTable.email, `%${SEED_EMAIL_SUFFIX}`);
  if (cursor) userCondition = and(userCondition, sql`${usersTable.id} < ${cursor}`);

  const users = await db
    .select()
    .from(usersTable)
    .where(userCondition)
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

router.delete("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);
  const adminUser = (req as any).user;
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (userId === adminUser.id) {
    res.status(400).json({ error: "You cannot delete your own account from here" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(userFollowsTable)
      .where(or(eq(userFollowsTable.followerId, userId), eq(userFollowsTable.followingId, userId)));
    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    await tx.delete(notificationsTable).where(eq(notificationsTable.actorId, userId));

    const authored = await tx.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, userId));
    for (const p of authored) {
      await tx.delete(commentsTable).where(eq(commentsTable.postId, p.id));
      await tx.delete(postPrayersTable).where(eq(postPrayersTable.postId, p.id));
      await tx.delete(savedPostsTable).where(eq(savedPostsTable.postId, p.id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.postId, p.id));
    }
    await tx.delete(postsTable).where(eq(postsTable.authorId, userId));

    await tx.delete(commentsTable).where(eq(commentsTable.authorId, userId));
    await tx.delete(postPrayersTable).where(eq(postPrayersTable.userId, userId));
    await tx.delete(savedPostsTable).where(eq(savedPostsTable.userId, userId));
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
  });

  res.json({ success: true, message: "User account removed" });
});

router.post("/admin/official-prayers", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const mod = (req as any).user;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }
  const scriptureRaw =
    typeof req.body?.scripture === "string" && req.body.scripture.trim() ? req.body.scripture.trim() : null;
  const textErr = officialGuideTextError({ title, content, scripture: scriptureRaw });
  if (textErr) {
    res.status(400).json({ error: textErr });
    return;
  }
  const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim() : "general";
  const durationMinutesGeneral =
    typeof req.body?.durationMinutes === "number" && Number.isFinite(req.body.durationMinutes)
      ? Math.round(req.body.durationMinutes)
      : null;
  const [row] = await db
    .insert(officialPrayersTable)
    .values({
      title,
      content,
      category,
      subtitle: typeof req.body?.subtitle === "string" ? req.body.subtitle : null,
      pathId: typeof req.body?.pathId === "number" ? req.body.pathId : null,
      audioUrl: typeof req.body?.audioUrl === "string" ? req.body.audioUrl.trim() : null,
      durationMinutes: durationMinutesGeneral != null && durationMinutesGeneral > 0 ? durationMinutesGeneral : null,
      scheduleSlot:
        typeof req.body?.scheduleSlot === "string" && ["morning", "evening"].includes(req.body.scheduleSlot)
          ? req.body.scheduleSlot
          : null,
      label: typeof req.body?.label === "string" ? req.body.label : null,
      uploadedByUserId: mod.id,
    })
    .returning();

  res.status(201).json(row);
});

/**
 * Set morning/evening sanctuary slot: optionally archive the previous slot content into a path
 * (official guides library), then update or create the scheduled row in place.
 */
router.post("/admin/official-prayers/schedule-slot", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const mod = (req as any).user;
  const slot =
    typeof req.body?.slot === "string" && ["morning", "evening"].includes(req.body.slot)
      ? (req.body.slot as "morning" | "evening")
      : null;
  if (!slot) {
    res.status(400).json({ error: "slot must be morning or evening" });
    return;
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }

  const archivePathId =
    typeof req.body?.archivePathId === "number" && Number.isFinite(req.body.archivePathId)
      ? req.body.archivePathId
      : null;
  const category =
    typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim() : "general";
  const subtitle = typeof req.body?.subtitle === "string" ? req.body.subtitle : null;
  const audioUrl = typeof req.body?.audioUrl === "string" ? req.body.audioUrl.trim() : null;
  const label = typeof req.body?.label === "string" ? req.body.label : null;
  const scripture =
    typeof req.body?.scripture === "string" && req.body.scripture.trim() ? req.body.scripture.trim() : null;
  const durationMinutes =
    typeof req.body?.durationMinutes === "number" && Number.isFinite(req.body.durationMinutes)
      ? Math.round(req.body.durationMinutes)
      : null;

  const textErrSchedule = officialGuideTextError({ title, content, scripture });
  if (textErrSchedule) {
    res.status(400).json({ error: textErrSchedule });
    return;
  }

  const [slotOccupied] = await db
    .select({ id: officialPrayersTable.id })
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.scheduleSlot, slot))
    .limit(1);

  if (slotOccupied && archivePathId == null) {
    res.status(400).json({
      error:
        "archivePathId is required when replacing an existing morning or evening guide (the previous version is saved to that path).",
    });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(officialPrayersTable)
      .where(eq(officialPrayersTable.scheduleSlot, slot))
      .limit(1);

    if (existing && archivePathId != null) {
      // Convert the existing row into the archive (keeps its ID so user saves remain valid).
      // Saves pointing to existing.id will show old content in the Saved tab.
      await tx
        .update(officialPrayersTable)
        .set({
          scheduleSlot: null,
          label: `archived_${slot}`,
          pathId: archivePathId,
        })
        .where(eq(officialPrayersTable.id, existing.id));
    }

    if (existing) {
      // Insert brand-new row for the slot — new ID means users haven't saved it yet.
      const [row] = await tx
        .insert(officialPrayersTable)
        .values({
          title,
          content,
          category,
          subtitle,
          audioUrl,
          label,
          scripture,
          durationMinutes,
          pathId: null,
          scheduleSlot: slot,
          uploadedByUserId: mod.id,
        })
        .returning();
      return row ?? null;
    }

    const [inserted] = await tx
      .insert(officialPrayersTable)
      .values({
        title,
        content,
        category,
        subtitle,
        audioUrl,
        label,
        scripture,
        durationMinutes,
        pathId: null,
        scheduleSlot: slot,
        uploadedByUserId: mod.id,
      })
      .returning();
    return inserted ?? null;
  });

  res.json(result);
});

router.delete("/admin/official-prayers/:prayerId", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.prayerId) ? req.params.prayerId[0] : req.params.prayerId;
  const prayerId = parseInt(rawId, 10);
  if (Number.isNaN(prayerId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [target] = await db
    .select()
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.id, prayerId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const slot = target.scheduleSlot as "morning" | "evening" | null;

  if (slot === "morning" || slot === "evening") {
    // Find the most recently archived prayer for this slot (tagged by schedule-slot route)
    const [prev] = await db
      .select({ id: officialPrayersTable.id })
      .from(officialPrayersTable)
      .where(
        and(
          eq(officialPrayersTable.label, `archived_${slot}`),
          isNull(officialPrayersTable.scheduleSlot),
        ),
      )
      .orderBy(desc(officialPrayersTable.createdAt))
      .limit(1);

    await db.transaction(async (tx) => {
      if (prev) {
        // Migrate saves from deleted prayer to the restored archive
        await tx
          .update(savedOfficialPrayersTable)
          .set({ officialPrayerId: prev.id })
          .where(eq(savedOfficialPrayersTable.officialPrayerId, prayerId));

        // Restore the archive to the active slot
        await tx
          .update(officialPrayersTable)
          .set({ scheduleSlot: slot, label: null, pathId: null })
          .where(eq(officialPrayersTable.id, prev.id));
      }

      await tx.delete(officialPrayersTable).where(eq(officialPrayersTable.id, prayerId));
    });

    res.json({ success: true, restoredPreviousSlot: !!prev });
    return;
  }

  await db.delete(officialPrayersTable).where(eq(officialPrayersTable.id, prayerId));
  res.json({ success: true });
});

router.post("/admin/prayer-paths", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim() : "general";
  if (!name || !description) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }
  const [row] = await db
    .insert(prayerPathsTable)
    .values({
      name,
      description,
      category,
      tagline: typeof req.body?.tagline === "string" ? req.body.tagline : null,
    })
    .returning();
  res.status(201).json(row);
});

export default router;
