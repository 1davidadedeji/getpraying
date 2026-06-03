import { Router, type IRouter } from "express";
import { db, notificationsTable, usersTable, postsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  // Enrich with actor info and post preview
  const actorIds = notifications.filter((n) => n.actorId != null).map((n) => n.actorId!);
  const postIds = notifications.filter((n) => n.postId != null).map((n) => n.postId!);

  let actorsMap = new Map<number, { username: string; avatarUrl: string | null }>();
  if (actorIds.length > 0) {
    const actors = await db.select().from(usersTable).where(inArray(usersTable.id, actorIds));
    for (const a of actors) actorsMap.set(a.id, { username: a.username, avatarUrl: a.avatarUrl });
  }

  let postsMap = new Map<number, { content: string }>();
  if (postIds.length > 0) {
    const posts = await db.select().from(postsTable).where(inArray(postsTable.id, postIds));
    for (const p of posts) postsMap.set(p.id, { content: p.content });
  }

  res.json(
    notifications.map((n) => {
      const actor = n.actorId ? actorsMap.get(n.actorId) : null;
      const post = n.postId ? postsMap.get(n.postId) : null;
      const hideActor = n.type === "post_reported" || n.type === "mod_queue";
      return {
        id: n.id,
        type: n.type,
        message: actor && !hideActor ? `${actor.username} ${n.message}` : n.message,
        actorUsername: hideActor ? null : (actor?.username ?? null),
        actorAvatarUrl: hideActor ? null : (actor?.avatarUrl ?? null),
        postId: n.postId,
        postPreview: post ? post.content.substring(0, 100) : null,
        category: n.category,
        isRead: n.isRead,
        createdAt: n.createdAt,
      };
    })
  );
});

router.get("/notifications/:notificationId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.notificationId)
    ? req.params.notificationId[0]
    : req.params.notificationId;
  const notificationId = parseInt(rawId, 10);
  if (Number.isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  const [n] = await db
    .select()
    .from(notificationsTable)
    .where(
      and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, user.id)),
    )
    .limit(1);

  if (!n) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  let actorUsername: string | null = null;
  const hideActor = n.type === "post_reported" || n.type === "mod_queue";
  if (n.actorId != null && !hideActor) {
    const [a] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, n.actorId))
      .limit(1);
    actorUsername = a?.username ?? null;
  }

  res.json({
    id: n.id,
    type: n.type,
    postId: n.postId,
    category: n.category,
    actorUsername: hideActor ? null : actorUsername,
  });
});

router.post("/notifications/read", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, user.id));

  res.json({ success: true, message: "Notifications marked as read" });
});

router.post("/notifications/:notificationId/read", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;
  const notificationId = parseInt(rawId, 10);
  if (Number.isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, user.id)));

  res.json({ success: true });
});

export default router;
