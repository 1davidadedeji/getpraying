import { parseCalendarDateString } from "./dailyWordCatalog";
import { localDateString, localHourMinute } from "./scheduledNotificationTime";

/** Morning sanctuary / push slot starts at 4:00 in the user's timezone. */
export const MORNING_SLOT_HOUR = 4;

/** Evening sanctuary / push slot starts at 17:00 (5 PM) in the user's timezone. */
export const EVENING_SLOT_HOUR = 17;

export function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftCalendarDayYMD(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * Calendar dates for morning/evening sanctuary guides before each slot's go-live time.
 * Matches mobile `sanctuarySchedule` and the push scheduler hours.
 */
export function resolveSanctuarySlotDates(
  timezone: string,
  now = new Date(),
): { morningDate: string; eveningDate: string } {
  const today = localDateString(now, timezone);
  const hour = localHourMinute(timezone, now)?.hour ?? 0;
  const morningDate = hour < MORNING_SLOT_HOUR ? shiftCalendarDayYMD(today, -1) : today;
  const eveningDate = hour < EVENING_SLOT_HOUR ? shiftCalendarDayYMD(today, -1) : today;
  return { morningDate, eveningDate };
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Resolve ?date=YYYY-MM-DD for sanctuary reads; defaults to server-local today. */
export function resolveSanctuaryCalendarDate(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return formatDateYMD(new Date());
  return parseCalendarDateString(s) ? s : null;
}

export function parseScheduledDateFromBody(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const raw = b.scheduledDate ?? b.scheduled_date;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !parseCalendarDateString(trimmed)) return null;
  return trimmed;
}

export function scheduledDateProvidedInBody(body: unknown): boolean {
  if (body == null || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return "scheduledDate" in b || "scheduled_date" in b;
}
