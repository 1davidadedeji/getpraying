/** Morning sanctuary / push slot starts at 4:00 local time. */
export const MORNING_SLOT_HOUR = 4;

/** Evening sanctuary / push slot starts at 17:00 (5 PM) local time. */
export const EVENING_SLOT_HOUR = 17;

/**
 * Current hour (0–23) in the user's local calendar day.
 * Uses the device timezone via Intl (aligns with typical "local time" UX).
 */
export function getLocalClockHourNow(): number {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h !== undefined) {
      const parsed = parseInt(h, 10);
      return parsed === 24 ? 0 : parsed;
    }
  } catch {
    /* fall through */
  }
  return new Date().getHours();
}

/** Evening sanctuary slot: from 5:00 PM through 3:59 AM local (until morning slot at 4 AM). */
export function isEveningSanctuarySlotNow(): boolean {
  const hour = getLocalClockHourNow();
  return hour >= EVENING_SLOT_HOUR || hour < MORNING_SLOT_HOUR;
}
