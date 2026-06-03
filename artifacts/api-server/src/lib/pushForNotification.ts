import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendSingleExpoPush } from "./expoPushSend";

function pushTitle(type: string, actorUsername: string | null): string {
  switch (type) {
    case "prayer":
      return "Get Praying";
    case "prayer_milestone":
      return "Your prayer is spreading";
    case "saved":
      return actorUsername ? `${actorUsername} saved your prayer` : "Someone saved your prayer";
    case "comment":
      return actorUsername ? `${actorUsername} commented` : "New comment on your prayer";
    case "follow":
      return actorUsername ? `${actorUsername} followed you` : "New follower";
    case "post_reported":
      return "Your prayer was reported";
    case "reminder":
      return "Prayer reminder";
    case "category_new":
      return "Library update";
    case "post_approved":
      return "Prayer approved";
    case "post_declined":
      return "Prayer not approved";
    case "mod_queue":
      return "Moderation needed";
    case "role_updated":
      return "Your role was updated";
    case "system":
      return "Get Praying";
    default:
      return "Notification";
  }
}

function stringifyData(data: Record<string, string | number | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

/** Send a push notification directly to a token (no DB row required — for broadcast/scheduled use). */
/** @returns true when Expo accepted the push (ticket status `ok`). */
export async function sendDirectPush(
  expoToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<boolean> {
  return sendSingleExpoPush({
    to: expoToken,
    title,
    body,
    data,
  });
}

/** Fire-and-forget remote alert for a stored notification row (recipient must have an Expo token). */
export async function pushForNotificationById(notificationId: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        message: notificationsTable.message,
        postId: notificationsTable.postId,
        actorId: notificationsTable.actorId,
        category: notificationsTable.category,
        token: usersTable.expoPushToken,
        recipientId: notificationsTable.userId,
      })
      .from(notificationsTable)
      .innerJoin(usersTable, eq(usersTable.id, notificationsTable.userId))
      .where(eq(notificationsTable.id, notificationId))
      .limit(1);

    if (!row) {
      console.warn("[push] notification not found:", notificationId);
      return false;
    }

    const token = row.token?.trim();
    if (!token) {
      console.warn("[push] no expo token for user", row.recipientId, "notification", notificationId);
      return false;
    }

    const anonymousTypes = new Set(["post_reported", "mod_queue"]);
    let actorUsername: string | null = null;
    if (row.actorId != null && !anonymousTypes.has(row.type)) {
      const [a] = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, row.actorId))
        .limit(1);
      actorUsername = a?.username ?? null;
    }

    const title = pushTitle(row.type, actorUsername);
    const body =
      row.type === "post_reported"
        ? "Your prayer was reported. Our team will review it."
        : row.message.length > 160
          ? `${row.message.slice(0, 157)}…`
          : row.message;
    const data = stringifyData({
      notificationId: row.id,
      type: row.type,
      postId: row.postId,
      actorUsername: anonymousTypes.has(row.type) ? null : actorUsername,
      category: row.category,
    });

    const ok = await sendSingleExpoPush({ to: token, title, body, data });
    if (!ok) {
      console.warn("[push] delivery failed for notification", notificationId, "user", row.recipientId);
    }
    return ok;
  } catch (e) {
    console.warn("[push] pushForNotificationById:", e);
    return false;
  }
}
