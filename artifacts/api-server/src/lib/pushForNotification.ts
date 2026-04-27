import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function pushTitle(type: string, actorUsername: string | null): string {
  switch (type) {
    case "prayer":
      return actorUsername ? `${actorUsername} prayed with you` : "Someone prayed with you";
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
      return "GetPraying";
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

async function sendExpoPush(
  expoToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (!expoToken || expoToken.length < 16) return;
  const message = {
    to: expoToken,
    title,
    body,
    data,
    sound: "default",
    priority: "high" as const,
    channelId: "default",
  };
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([message]),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[push] Expo push non-OK:", res.status, t.slice(0, 200));
    }
  } catch (e) {
    console.warn("[push] Expo push failed:", e);
  }
}

/** Fire-and-forget remote alert for a stored notification row (recipient must have an Expo token). */
export async function pushForNotificationById(notificationId: number): Promise<void> {
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
      })
      .from(notificationsTable)
      .innerJoin(usersTable, eq(usersTable.id, notificationsTable.userId))
      .where(eq(notificationsTable.id, notificationId))
      .limit(1);

    if (!row?.token?.trim()) return;

    let actorUsername: string | null = null;
    if (row.actorId != null) {
      const [a] = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, row.actorId))
        .limit(1);
      actorUsername = a?.username ?? null;
    }

    const title = pushTitle(row.type, actorUsername);
    const body =
      row.message.length > 160 ? `${row.message.slice(0, 157)}…` : row.message;
    const data = stringifyData({
      notificationId: row.id,
      type: row.type,
      postId: row.postId,
      actorUsername,
      category: row.category,
    });

    await sendExpoPush(row.token.trim(), title, body, data);
  } catch (e) {
    console.warn("[push] pushForNotificationById:", e);
  }
}
