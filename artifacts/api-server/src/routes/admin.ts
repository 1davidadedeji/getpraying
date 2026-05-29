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
  appSettingsTable,
} from "@workspace/db";
import { eq, ne, desc, sql, and, or, isNotNull, isNull, inArray, notLike, type SQL } from "drizzle-orm";

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";
import { requireAdmin, requireModeratorOrAdmin } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";
import { clearModQueueNotificationsForPost, notifyModeratorsNewPending } from "../lib/modQueueNotifications";
import { attachReportsForStaff, clearPostReportsForPost } from "../lib/postReports";
import { officialGuideTextError } from "../lib/officialGuideTextLimits";
import { pushForNotificationById } from "../lib/pushForNotification";
import { applyAutoBoostIfEligible } from "../lib/autoBoost";
import {
  parseTracksFromBody,
  syncLectureTracks,
  fetchTracksForLecture,
  type LectureTrackInput,
} from "../lib/lectureTracks";

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

const ADMIN_POSTS_MAX_LIMIT = 50;

/** Mobile admin (`mobile/app/admin/users.tsx`) requests up to 200 users without paging; keep cap generous. */
const ADMIN_USERS_MAX_LIMIT = 500;

function clampAdminPostsLimit(raw: unknown, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, ADMIN_POSTS_MAX_LIMIT);
}

function adminPostSearchPattern(q: string): string | null {
  const t = q.trim();
  if (!t) return null;
  return `%${t.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

function adminPostsSearchCondition(pattern: string): SQL {
  return or(
    sql`${postsTable.content} ilike ${pattern}`,
    sql`exists (select 1 from users u where u.id = ${postsTable.authorId} and (u.username ilike ${pattern} or coalesce(u.display_name,'') ilike ${pattern}))`,
  )!;
}

function adminUsersSearchCondition(pattern: string): SQL {
  return or(
    sql`${usersTable.username} ilike ${pattern}`,
    sql`${usersTable.email} ilike ${pattern}`,
    sql`coalesce(${usersTable.displayName}, '') ilike ${pattern}`,
  )!;
}

function adminPostsCategoryCondition(category: string): SQL | undefined {
  const c = category.trim();
  if (!c) return undefined;
  return eq(postsTable.category, c);
}

function adminPostsMediaCondition(media: string): SQL | undefined {
  const m = media.trim().toLowerCase();
  if (m === "image") return eq(postsTable.mediaType, "image");
  if (m === "video") return eq(postsTable.mediaType, "video");
  if (m === "none" || m === "text") return or(isNull(postsTable.mediaUrl), eq(postsTable.mediaUrl, ""));
  return undefined;
}

router.get("/admin/pending-count", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(eq(postsTable.status, "pending"));
  res.json({ count: result[0]?.count ?? 0 });
});

router.get("/admin/posts/pending", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const limit = clampAdminPostsLimit(req.query.limit, 20);
  const pageReq = Math.max(1, parseInt((req.query.page as string) || "1", 10));

  const qRaw = typeof req.query.q === "string" ? req.query.q : "";
  const categoryRaw = typeof req.query.category === "string" ? req.query.category : "";
  const mediaRaw = typeof req.query.media === "string" ? req.query.media : "";

  const parts: SQL[] = [eq(postsTable.status, "pending")];
  const catSql = adminPostsCategoryCondition(categoryRaw);
  if (catSql) parts.push(catSql);
  const mediaSql = adminPostsMediaCondition(mediaRaw);
  if (mediaSql) parts.push(mediaSql);
  const qPat = adminPostSearchPattern(qRaw);
  if (qPat) parts.push(adminPostsSearchCondition(qPat));

  const whereBase = and(...parts)!;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(whereBase);

  const totalMatching = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalMatching / limit));
  const page = Math.min(pageReq, totalPages);
  const offset = (page - 1) * limit;

  const slice = await db
    .select()
    .from(postsTable)
    .where(whereBase)
    .orderBy(postsTable.createdAt, postsTable.id)
    .limit(limit)
    .offset(offset);

  const mod = (req as any).user;
  const enriched = await enrichPosts(slice, mod.id);
  const withReports = await attachReportsForStaff(enriched);

  res.json({
    posts: withReports,
    page,
    limit,
    totalMatching,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
});

router.get("/admin/posts/moderated", requireAdmin, async (req, res): Promise<void> => {
  const limit = clampAdminPostsLimit(req.query.limit, 25);
  const pageReq = Math.max(1, parseInt((req.query.page as string) || "1", 10));

  const qRaw = typeof req.query.q === "string" ? req.query.q : "";
  const categoryRaw = typeof req.query.category === "string" ? req.query.category : "";
  const mediaRaw = typeof req.query.media === "string" ? req.query.media : "";
  const statusRaw = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "all";

  // Exclude posts authored by seed accounts
  const seedUserIds = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.email} LIKE ${"%" + SEED_EMAIL_SUFFIX}`);
  const seedIds = seedUserIds.map((u) => u.id);

  const parts: SQL[] = [];
  if (statusRaw === "approved") parts.push(eq(postsTable.status, "approved"));
  else if (statusRaw === "declined") parts.push(eq(postsTable.status, "declined"));
  else parts.push(ne(postsTable.status, "pending"));

  if (seedIds.length > 0) {
    parts.push(sql`${postsTable.authorId} NOT IN (${sql.join(seedIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  const catSql = adminPostsCategoryCondition(categoryRaw);
  if (catSql) parts.push(catSql);
  const mediaSql = adminPostsMediaCondition(mediaRaw);
  if (mediaSql) parts.push(mediaSql);
  const qPat = adminPostSearchPattern(qRaw);
  if (qPat) parts.push(adminPostsSearchCondition(qPat));

  const whereBase = and(...parts)!;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(whereBase);

  const totalMatching = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalMatching / limit));
  const page = Math.min(pageReq, totalPages);
  const offset = (page - 1) * limit;

  const slice = await db
    .select()
    .from(postsTable)
    .where(whereBase)
    .orderBy(desc(postsTable.updatedAt), desc(postsTable.id))
    .limit(limit)
    .offset(offset);

  const enriched = await enrichPosts(slice);

  res.json({
    posts: enriched,
    page,
    limit,
    totalMatching,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
});

router.post("/admin/posts/:postId/approve", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const postId = parseInt(rawId, 10);
  const mod = (req as any).user;

  const [post] = await db
    .update(postsTable)
    .set({ status: "approved", moderatedByUserId: mod.id, moderationReason: null, flagReason: null, flagCount: 0 })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await clearModQueueNotificationsForPost(postId);
  await clearPostReportsForPost(postId);
  await notifyAuthorPostDecision(post.authorId ?? null, post.id, "approved");

  const boostedPost = await applyAutoBoostIfEligible(post);
  const [enriched] = await enrichPosts([boostedPost]);
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
      flagReason: null,
      flagCount: 0,
    })
    .where(eq(postsTable.id, postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await clearModQueueNotificationsForPost(postId);
  await clearPostReportsForPost(postId);
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
  const limitRaw = parseInt((req.query.limit as string) || "30", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 30), ADMIN_USERS_MAX_LIMIT);
  const pageReq = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const qRaw = typeof req.query.q === "string" ? req.query.q : "";

  let userCondition: SQL = notLike(usersTable.email, `%${SEED_EMAIL_SUFFIX}`);
  const qPat = adminPostSearchPattern(qRaw);
  if (qPat) userCondition = and(userCondition, adminUsersSearchCondition(qPat))!;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(userCondition);

  const totalMatching = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalMatching / limit));
  const page = Math.min(pageReq, totalPages);
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(usersTable)
    .where(userCondition)
    .orderBy(desc(usersTable.createdAt), desc(usersTable.id))
    .limit(limit)
    .offset(offset);

  res.json({
    users: rows.map((u) => ({
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
    page,
    limit,
    totalMatching,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
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
  if (!title) {
    res.status(400).json({ error: "title is required" });
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
  const scheduleSlot =
    typeof req.body?.scheduleSlot === "string" && ["morning", "evening"].includes(req.body.scheduleSlot)
      ? req.body.scheduleSlot
      : null;
  if (category === "sanctuary" && !scheduleSlot) {
    res.status(400).json({ error: "Sanctuary guides require a morning or evening slot." });
    return;
  }
  let pathIdRaw = typeof req.body?.pathId === "number" ? req.body.pathId : null;
  if (category === "lectures") {
    pathIdRaw = null;
  }
  const durationMinutesGeneral =
    typeof req.body?.durationMinutes === "number" && Number.isFinite(req.body.durationMinutes)
      ? Math.round(req.body.durationMinutes)
      : null;

  const isLecture = category === "lectures";
  const tracksParsed = isLecture ? parseTracksFromBody(req.body) : undefined;
  const legacyAudioUrl =
    typeof req.body?.audioUrl === "string" && req.body.audioUrl.trim() ? req.body.audioUrl.trim() : null;

  let tracksToSync: LectureTrackInput[] | undefined;
  if (isLecture) {
    if (tracksParsed != null) {
      tracksToSync = tracksParsed;
    } else if (legacyAudioUrl) {
      tracksToSync = [{ title, audioUrl: legacyAudioUrl, orderIndex: 0 }];
    }
  }

  const [row] = await db
    .insert(officialPrayersTable)
    .values({
      title,
      content,
      category,
      subtitle: typeof req.body?.subtitle === "string" ? req.body.subtitle : null,
      scripture: scriptureRaw,
      pathId: pathIdRaw,
      audioUrl: isLecture ? null : legacyAudioUrl,
      durationMinutes: durationMinutesGeneral != null && durationMinutesGeneral > 0 ? durationMinutesGeneral : null,
      scheduleSlot,
      label: typeof req.body?.label === "string" ? req.body.label : null,
      uploadedByUserId: mod.id,
    })
    .returning();

  if (isLecture && row && tracksToSync != null) {
    try {
      const tracks = await syncLectureTracks(row.id, tracksToSync);
      res.status(201).json({ ...row, audioUrl: null, tracks });
      return;
    } catch (e) {
      await db.delete(officialPrayersTable).where(eq(officialPrayersTable.id, row.id));
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid tracks" });
      return;
    }
  }

  res.status(201).json(row);
});

router.put("/admin/official-prayers/:prayerId", requireModeratorOrAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.prayerId) ? req.params.prayerId[0] : req.params.prayerId;
  const prayerId = parseInt(String(rawId), 10);
  if (Number.isNaN(prayerId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.id, prayerId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : existing.title;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : existing.content;
  let scriptureNext: string | null = existing.scripture;
  if (req.body != null && "scripture" in req.body) {
    const s = req.body.scripture;
    scriptureNext = typeof s === "string" && s.trim() ? s.trim() : null;
  }

  const textErrPut = officialGuideTextError({
    title,
    content,
    scripture: scriptureNext,
  });
  if (textErrPut) {
    res.status(400).json({ error: textErrPut });
    return;
  }

  const categoryNext =
    typeof req.body?.category === "string" && req.body.category.trim()
      ? req.body.category.trim()
      : existing.category;

  let subtitleNext = existing.subtitle;
  if (req.body != null && "subtitle" in req.body) {
    subtitleNext = typeof req.body.subtitle === "string" ? req.body.subtitle : null;
  }

  let labelNext = existing.label;
  if (req.body != null && "label" in req.body) {
    labelNext = typeof req.body.label === "string" ? req.body.label : null;
  }

  let pathIdNext = existing.pathId;
  if (req.body != null && "pathId" in req.body) {
    pathIdNext =
      typeof req.body.pathId === "number" && Number.isFinite(req.body.pathId) ? req.body.pathId : null;
  }
  if (categoryNext === "lectures" || existing.category === "lectures") {
    pathIdNext = null;
  }

  let audioUrlNext = existing.audioUrl;
  if (typeof req.body?.audioUrl === "string") {
    const u = req.body.audioUrl.trim();
    audioUrlNext = u.length > 0 ? u : null;
  }
  if (categoryNext === "lectures" || existing.category === "lectures") {
    audioUrlNext = null;
  }

  let durationNext = existing.durationMinutes;
  if (req.body != null && "durationMinutes" in req.body) {
    const dm = req.body.durationMinutes;
    durationNext =
      typeof dm === "number" && Number.isFinite(dm) ? Math.round(dm) : null;
    if (durationNext != null && durationNext <= 0) durationNext = null;
  }

  await db
    .update(officialPrayersTable)
    .set({
      title,
      content,
      category: categoryNext,
      subtitle: subtitleNext,
      label: labelNext,
      scripture: scriptureNext,
      pathId: pathIdNext,
      audioUrl: audioUrlNext,
      durationMinutes: durationNext,
    })
    .where(eq(officialPrayersTable.id, prayerId));

  const isLectureRow = categoryNext === "lectures" || existing.category === "lectures";
  const tracksParsed = isLectureRow ? parseTracksFromBody(req.body) : undefined;
  if (isLectureRow && tracksParsed != null) {
    try {
      const tracks = await syncLectureTracks(prayerId, tracksParsed);
      const [row] = await db
        .select()
        .from(officialPrayersTable)
        .where(eq(officialPrayersTable.id, prayerId))
        .limit(1);
      res.json({ ...(row ?? { success: true }), tracks });
      return;
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid tracks" });
      return;
    }
  }

  const [row] = await db
    .select()
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.id, prayerId))
    .limit(1);

  if (isLectureRow) {
    const tracks = await fetchTracksForLecture(prayerId);
    res.json({ ...(row ?? { success: true }), tracks });
    return;
  }

  res.json(row ?? { success: true });
});

/**
 * Set morning/evening sanctuary slot. If a guide already occupies the slot, it is removed
 * (saved-user rows cleared for that id) — it is not moved into a path / situation category.
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
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

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

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: officialPrayersTable.id })
      .from(officialPrayersTable)
      .where(eq(officialPrayersTable.scheduleSlot, slot))
      .limit(1);

    if (existing) {
      await tx
        .delete(savedOfficialPrayersTable)
        .where(eq(savedOfficialPrayersTable.officialPrayerId, existing.id));
      await tx.delete(officialPrayersTable).where(eq(officialPrayersTable.id, existing.id));
    }

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
        durationMinutes: durationMinutes != null && durationMinutes > 0 ? durationMinutes : null,
        pathId: null,
        scheduleSlot: slot,
        uploadedByUserId: mod.id,
      })
      .returning();
    return row ?? null;
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
    await db.transaction(async (tx) => {
      await tx
        .delete(savedOfficialPrayersTable)
        .where(eq(savedOfficialPrayersTable.officialPrayerId, prayerId));
      await tx.delete(officialPrayersTable).where(eq(officialPrayersTable.id, prayerId));
    });
    res.json({ success: true });
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

// ---------------------------------------------------------------------------
// App store URL settings (ios_app_store_url, android_play_store_url, og_image_url)
// Stored in app_settings — changes apply immediately (no app rebuild needed).
// ---------------------------------------------------------------------------
const STORE_SETTING_KEYS = ["ios_app_store_url", "android_play_store_url", "og_image_url"] as const;
type StoreSettingKey = (typeof STORE_SETTING_KEYS)[number];

router.get("/admin/app-settings/store", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, [...STORE_SETTING_KEYS]));
  const result = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Record<StoreSettingKey, string>>;
  res.json(result);
});

router.put("/admin/app-settings/store", requireAdmin, async (req, res): Promise<void> => {
  const updates: { key: StoreSettingKey; value: string }[] = [];
  for (const key of STORE_SETTING_KEYS) {
    const raw = req.body?.[key];
    if (typeof raw === "string") {
      updates.push({ key, value: raw.trim() });
    }
  }
  if (updates.length === 0) {
    res.status(400).json({ error: "Provide at least one of: " + STORE_SETTING_KEYS.join(", ") });
    return;
  }
  for (const { key, value } of updates) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ updated: updates.map((u) => u.key) });
});

export default router;
