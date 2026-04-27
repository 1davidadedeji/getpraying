import { db, notificationsTable, usersTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { pushForNotificationById } from "./pushForNotification";

const MOD_QUEUE = "mod_queue" as const;

/** Removes queue alerts for this post for every moderator (after approve/decline, or before re-notifying). */
export async function clearModQueueNotificationsForPost(postId: number): Promise<void> {
  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.type, MOD_QUEUE), eq(notificationsTable.postId, postId)));
}

/** Notifies all staff (except the author) that a post needs review. Idempotent: clears old mod_queue rows for this post first. */
export async function notifyModeratorsNewPending(postId: number, authorId: number): Promise<void> {
  await clearModQueueNotificationsForPost(postId);
  const staff = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "moderator"), eq(usersTable.role, "admin")));
  const rows = staff
    .filter((s) => s.id !== authorId)
    .map((s) => ({
      userId: s.id,
      type: MOD_QUEUE,
      message: "A new prayer is waiting in the moderation queue.",
      postId,
      isRead: false,
    }));
  if (rows.length === 0) return;
  const inserted = await db.insert(notificationsTable).values(rows).returning({ id: notificationsTable.id });
  for (const row of inserted) void pushForNotificationById(row.id);
}
