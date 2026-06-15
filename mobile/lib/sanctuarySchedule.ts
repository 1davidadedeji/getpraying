import { isEveningSanctuarySlotNow, MORNING_SLOT_HOUR, EVENING_SLOT_HOUR } from "@/lib/localClock";

export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.length > 0) return tz;
  } catch {
    /* fall through */
  }
  return "UTC";
}

function localDateYMD(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function localHourInTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h !== undefined) {
      const parsed = parseInt(h, 10);
      return parsed === 24 ? 0 : parsed;
    }
  } catch {
    /* fall through */
  }
  return date.getHours();
}

/** Slot-aware calendar dates for morning/evening guides (matches server scheduler). */
export function resolveSanctuarySlotDates(
  timezone: string,
  now = new Date(),
): { morningDate: string; eveningDate: string } {
  const today = localDateYMD(now, timezone);
  const hour = localHourInTimezone(now, timezone);
  const morningDate = hour < MORNING_SLOT_HOUR ? shiftCalendarDayYMD(today, -1) : today;
  const eveningDate = hour < EVENING_SLOT_HOUR ? shiftCalendarDayYMD(today, -1) : today;
  return { morningDate, eveningDate };
}

/** GET path with timezone so the API resolves slot-aware go-live dates. */
export function sanctuaryLibraryPath(): string {
  const tz = getDeviceTimezone();
  const params = new URLSearchParams({ timezone: tz });
  return `/library/official/sanctuary?${params.toString()}`;
}

/** Changes when slot boundaries or slot dates change — use to trigger sanctuary refetch. */
export function sanctuaryScheduleFingerprint(): string {
  const tz = getDeviceTimezone();
  const { morningDate, eveningDate } = resolveSanctuarySlotDates(tz);
  const evening = isEveningSanctuarySlotNow();
  return `${tz}|${morningDate}|${eveningDate}|${evening ? "e" : "m"}`;
}
