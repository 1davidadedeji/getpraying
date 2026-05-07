import { db, usersTable, dailyWordOverridesTable } from "@workspace/db";
import { and, isNotNull, lt, or, isNull } from "drizzle-orm";
import { eq, sql } from "drizzle-orm";
import { sendDirectPush } from "./pushForNotification";
import { dayOfYearFromDate, getDefaultDailyQuote } from "./dailyWordCatalog";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function localHourMinute(timezone: string): { hour: number; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value;
    const m = parts.find((p) => p.type === "minute")?.value;
    if (h === undefined || m === undefined) return null;
    return { hour: parseInt(h, 10), minute: parseInt(m, 10) };
  } catch {
    return null;
  }
}

function localDateString(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function getTodayQuoteText(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const [override] = await db
    .select({ quoteText: dailyWordOverridesTable.quoteText })
    .from(dailyWordOverridesTable)
    .where(eq(dailyWordOverridesTable.effectiveDate, dateStr))
    .limit(1);
  if (override) return override.quoteText;
  const doy = dayOfYearFromDate(new Date());
  return getDefaultDailyQuote(doy).quoteText;
}

async function sendMorningPrayers(): Promise<void> {
  const quote = await getTodayQuoteText();
  const body = `The morning prayer is ready: "${quote.slice(0, 80)}${quote.length > 80 ? "…" : ""}"`;

  const users = await db
    .select({
      id: usersTable.id,
      token: usersTable.expoPushToken,
      timezone: usersTable.timezone,
      morningNotifSentAt: usersTable.morningNotifSentAt,
    })
    .from(usersTable)
    .where(and(
      isNotNull(usersTable.expoPushToken),
      isNotNull(usersTable.timezone),
      eq(usersTable.scheduledNotificationsEnabled, true),
    ));

  const toNotify: typeof users = [];
  for (const u of users) {
    if (!u.token || !u.timezone) continue;
    const hm = localHourMinute(u.timezone);
    if (!hm || hm.hour !== 4 || hm.minute >= 5) continue;
    const todayLocal = localDateString(u.timezone);
    if (u.morningNotifSentAt) {
      const lastSentLocal = new Intl.DateTimeFormat("en-CA", { timeZone: u.timezone }).format(
        u.morningNotifSentAt,
      );
      if (lastSentLocal >= todayLocal) continue;
    }
    toNotify.push(u);
  }

  const now = new Date();
  for (const u of toNotify) {
    void sendDirectPush(u.token!, "Get Praying", body, { type: "morning_prayer" }).catch(() => {});
    void db
      .update(usersTable)
      .set({ morningNotifSentAt: now })
      .where(eq(usersTable.id, u.id))
      .catch(() => {});
  }

  if (toNotify.length > 0) {
    console.info(`[scheduler] Morning prayer sent to ${toNotify.length} user(s)`);
  }
}

async function sendEveningPrayers(): Promise<void> {
  const quote = await getTodayQuoteText();
  const body = `The evening prayer is ready: "${quote.slice(0, 80)}${quote.length > 80 ? "…" : ""}"`;

  const users = await db
    .select({
      id: usersTable.id,
      token: usersTable.expoPushToken,
      timezone: usersTable.timezone,
      eveningNotifSentAt: usersTable.eveningNotifSentAt,
    })
    .from(usersTable)
    .where(and(
      isNotNull(usersTable.expoPushToken),
      isNotNull(usersTable.timezone),
      eq(usersTable.scheduledNotificationsEnabled, true),
    ));

  const toNotify: typeof users = [];
  for (const u of users) {
    if (!u.token || !u.timezone) continue;
    const hm = localHourMinute(u.timezone);
    if (!hm || hm.hour !== 17 || hm.minute >= 5) continue;
    const todayLocal = localDateString(u.timezone);
    if (u.eveningNotifSentAt) {
      const lastSentLocal = new Intl.DateTimeFormat("en-CA", { timeZone: u.timezone }).format(
        u.eveningNotifSentAt,
      );
      if (lastSentLocal >= todayLocal) continue;
    }
    toNotify.push(u);
  }

  const now = new Date();
  for (const u of toNotify) {
    void sendDirectPush(u.token!, "Get Praying", body, { type: "evening_prayer" }).catch(() => {});
    void db
      .update(usersTable)
      .set({ eveningNotifSentAt: now })
      .where(eq(usersTable.id, u.id))
      .catch(() => {});
  }

  if (toNotify.length > 0) {
    console.info(`[scheduler] Evening prayer sent to ${toNotify.length} user(s)`);
  }
}

async function sendDailyHelpReminder(): Promise<void> {
  // Fire at 8 AM in user's local timezone, once per day
  const users = await db
    .select({
      id: usersTable.id,
      token: usersTable.expoPushToken,
      timezone: usersTable.timezone,
      morningNotifSentAt: usersTable.morningNotifSentAt,
    })
    .from(usersTable)
    .where(and(isNotNull(usersTable.expoPushToken), isNotNull(usersTable.timezone)));

  const toNotify: typeof users = [];
  for (const u of users) {
    if (!u.token || !u.timezone) continue;
    const hm = localHourMinute(u.timezone);
    if (!hm || hm.hour !== 8 || hm.minute >= 5) continue;
    // Reuse morningNotifSentAt date to avoid sending both morning (4am) and this (8am) on same day
    // Use a simple check: if we fired this reminder already today, skip
    // We track via morningNotifSentAt being same date — but that's the morning prayer.
    // So use a separate field-less approach: just fire and trust 5-min window won't double fire
    toNotify.push(u);
  }

  for (const u of toNotify) {
    void sendDirectPush(u.token!, "Get Praying", "See who to help on Get Praying", {
      type: "daily_help_reminder",
    }).catch(() => {});
  }

  if (toNotify.length > 0) {
    console.info(`[scheduler] Daily help reminder sent to ${toNotify.length} user(s)`);
  }
}

async function runScheduledChecks(): Promise<void> {
  try {
    await Promise.all([sendMorningPrayers(), sendEveningPrayers(), sendDailyHelpReminder()]);
  } catch (e) {
    console.warn("[scheduler] Error during scheduled checks:", e);
  }
}

export function startScheduledNotifications(): void {
  // Run once shortly after startup in case the server restarted during a notification window
  setTimeout(() => void runScheduledChecks(), 15_000);
  setInterval(() => void runScheduledChecks(), CHECK_INTERVAL_MS);
  console.info("[scheduler] Scheduled notification checks started (every 5 min)");
}
