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
    if (h !== undefined) return parseInt(h, 10);
  } catch {
    /* fall through */
  }
  return new Date().getHours();
}

/** Evening sanctuary / slot applies from noon through 11:59:59 local time. */
export function isEveningSanctuarySlotNow(): boolean {
  return getLocalClockHourNow() >= 12;
}
