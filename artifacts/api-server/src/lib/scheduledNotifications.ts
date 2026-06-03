import { db, usersTable } from "@workspace/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { sendDirectPush } from "./pushForNotification";
import {
  inDeliveryWindow,
  localHourMinute,
  notSentTodayLocal,
} from "./scheduledNotificationTime";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
/**
 * Within each scheduled hour, keep trying until success or this minute bound.
 * At 5-minute polls that is up to six attempts (minutes 0, 5, …, 25).
 */
const DELIVERY_WINDOW_MINUTE_MAX = 29;
/** Postgres advisory lock — only one API process runs the scheduler at a time. */
const SCHEDULER_ADVISORY_LOCK_KEY = 0x475054520001;
let schedulerRunInFlight = false;

function parseTryLockResult(result: unknown): boolean {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === "object" && "rows" in result
      ? (result as { rows: unknown[] }).rows
      : [];
  return (rows[0] as { locked?: boolean } | undefined)?.locked === true;
}

type SentAtColumn = typeof usersTable.morningNotifSentAt | typeof usersTable.eveningNotifSentAt;

/** SQL guard for atomic mark-sent updates. */
function notSentTodaySql(sentAtColumn: SentAtColumn, timezone: string) {
  return sql`(
    ${sentAtColumn} IS NULL
    OR to_char(${sentAtColumn} AT TIME ZONE ${timezone}, 'YYYY-MM-DD')
       < to_char(NOW() AT TIME ZONE ${timezone}, 'YYYY-MM-DD')
  )`;
}

async function tryAcquireSchedulerLock(): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT pg_try_advisory_lock(${SCHEDULER_ADVISORY_LOCK_KEY}) AS locked`,
  );
  return parseTryLockResult(result);
}

async function releaseSchedulerLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${SCHEDULER_ADVISORY_LOCK_KEY})`);
}

function slotLockId(slot: ScheduledSlot): number {
  return slot === "morning" ? 1 : 2;
}

async function tryAcquireUserSlotLock(userId: number, slot: ScheduledSlot): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT pg_try_advisory_lock(${userId}, ${slotLockId(slot)}) AS locked`,
  );
  return parseTryLockResult(result);
}

async function releaseUserSlotLock(userId: number, slot: ScheduledSlot): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${userId}, ${slotLockId(slot)})`);
}

type ScheduledSlot = "morning" | "evening";

const SLOT_CONFIG: Record<
  ScheduledSlot,
  {
    targetHour: number;
    body: string;
    dataType: string;
    sentAtColumn: SentAtColumn;
    markSent: (now: Date) => { morningNotifSentAt?: Date; eveningNotifSentAt?: Date };
  }
> = {
  morning: {
    targetHour: 4,
    body: "The morning prayer is ready.",
    dataType: "morning_prayer",
    sentAtColumn: usersTable.morningNotifSentAt,
    markSent: (now) => ({ morningNotifSentAt: now }),
  },
  evening: {
    targetHour: 17,
    body: "The evening prayer is ready.",
    dataType: "evening_prayer",
    sentAtColumn: usersTable.eveningNotifSentAt,
    markSent: (now) => ({ eveningNotifSentAt: now }),
  },
};

async function sendScheduledSlot(slot: ScheduledSlot): Promise<number> {
  const { targetHour, body, dataType, sentAtColumn, markSent } = SLOT_CONFIG[slot];

  const users = await db
    .select({
      id: usersTable.id,
      token: usersTable.expoPushToken,
      timezone: usersTable.timezone,
      sentAt: sentAtColumn,
    })
    .from(usersTable)
    .where(
      and(
        isNotNull(usersTable.expoPushToken),
        isNotNull(usersTable.timezone),
        eq(usersTable.scheduledNotificationsEnabled, true),
      ),
    );

  let sent = 0;
  let failed = 0;
  const now = new Date();

  for (const u of users) {
    if (!u.token || !u.timezone) continue;
    const hm = localHourMinute(u.timezone);
    if (!inDeliveryWindow(hm, targetHour, DELIVERY_WINDOW_MINUTE_MAX)) continue;
    if (!notSentTodayLocal(u.sentAt, u.timezone)) continue;

    const userLocked = await tryAcquireUserSlotLock(u.id, slot);
    if (!userLocked) continue;

    try {
      const [fresh] = await db
        .select({
          token: usersTable.expoPushToken,
          sentAt: sentAtColumn,
        })
        .from(usersTable)
        .where(eq(usersTable.id, u.id))
        .limit(1);

      const token = fresh?.token?.trim();
      if (!token || !fresh || !notSentTodayLocal(fresh.sentAt, u.timezone)) continue;

      const delivered = await sendDirectPush(token, "Get Praying", body, { type: dataType });
      if (!delivered) {
        failed += 1;
        console.warn(
          `[scheduler] ${slot} push not delivered for user ${u.id}; will retry on next poll if still in window`,
        );
        continue;
      }

      const [marked] = await db
        .update(usersTable)
        .set(markSent(now))
        .where(and(eq(usersTable.id, u.id), notSentTodaySql(sentAtColumn, u.timezone)))
        .returning({ id: usersTable.id });

      if (marked) {
        sent += 1;
      } else {
        console.warn(
          `[scheduler] ${slot} push delivered for user ${u.id} but mark-sent lost race (already sent today)`,
        );
      }
    } finally {
      await releaseUserSlotLock(u.id, slot).catch(() => {});
    }
  }

  if (sent > 0 || failed > 0) {
    console.info(`[scheduler] ${slot}: ${sent} delivered, ${failed} failed (retryable)`);
  }
  return sent;
}

async function runScheduledChecks(): Promise<void> {
  if (schedulerRunInFlight) {
    return;
  }
  schedulerRunInFlight = true;

  const locked = await tryAcquireSchedulerLock();
  if (!locked) {
    schedulerRunInFlight = false;
    return;
  }

  try {
    await sendScheduledSlot("morning");
    await sendScheduledSlot("evening");
  } catch (e) {
    console.warn("[scheduler] Error during scheduled checks:", e);
  } finally {
    await releaseSchedulerLock().catch(() => {});
    schedulerRunInFlight = false;
  }
}

export function startScheduledNotifications(): void {
  setTimeout(() => void runScheduledChecks(), 15_000);
  setInterval(() => void runScheduledChecks(), CHECK_INTERVAL_MS);
  console.info(
    `[scheduler] Scheduled notification checks started (every ${CHECK_INTERVAL_MS / 60_000} min, delivery window minute 0–${DELIVERY_WINDOW_MINUTE_MAX})`,
  );
}
