import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendExpoPushMessages } from "./expoPushSend";

/** Fire Expo push to all registered device tokens (no per-user notification rows). */
export async function broadcastPushToRegisteredDevices(opts: {
  title: string;
  body: string;
  data: Record<string, string>;
  excludeUserIds?: Set<number>;
}): Promise<number> {
  const rows = await db
    .select({ token: usersTable.expoPushToken, id: usersTable.id })
    .from(usersTable)
    .where(
      sql`${usersTable.expoPushToken} IS NOT NULL AND length(trim(${usersTable.expoPushToken})) >= 16 AND ${usersTable.isBanned} IS NOT TRUE`,
    );

  const seen = new Set<string>();
  const exclude = opts.excludeUserIds ?? new Set<number>();
  const messages: Array<{
    to: string;
    title: string;
    body: string;
    data: Record<string, string>;
    sound: string;
    priority: "high";
    channelId: string;
  }> = [];

  for (const r of rows) {
    const raw = r.token?.trim();
    if (!raw || exclude.has(r.id)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);

    messages.push({
      to: raw,
      title: opts.title,
      body: opts.body.length > 180 ? `${opts.body.slice(0, 177)}…` : opts.body,
      data: opts.data,
      sound: "default",
      priority: "high",
      channelId: "default",
    });
  }

  if (messages.length === 0) return 0;

  const results = await sendExpoPushMessages(messages);
  return results.filter(Boolean).length;
}
