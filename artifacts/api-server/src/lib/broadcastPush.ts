import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Expo accepts multiple messages per request; keep batches small for reliability. */
const CHUNK = 96;

async function sendExpoBatch(
  batch: Array<{ to: string; title: string; body: string; data: Record<string, string>; sound?: string }>,
): Promise<void> {
  if (batch.length === 0) return;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[broadcastPush] Expo non-OK:", res.status, t.slice(0, 280));
    }
  } catch (e) {
    console.warn("[broadcastPush] Expo request failed:", e);
  }
}

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
  let sent = 0;

  let batch: Array<{ to: string; title: string; body: string; data: Record<string, string>; sound: string }> = [];

  for (const r of rows) {
    const raw = r.token?.trim();
    if (!raw || exclude.has(r.id)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);

    batch.push({
      to: raw,
      title: opts.title,
      body: opts.body.length > 180 ? `${opts.body.slice(0, 177)}…` : opts.body,
      data: opts.data,
      sound: "default",
    });
    sent++;
    if (batch.length >= CHUNK) {
      await sendExpoBatch(batch);
      batch = [];
    }
  }
  if (batch.length > 0) await sendExpoBatch(batch);
  return sent;
}
