export function localDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** User has not received this slot's push yet today in their timezone. */
export function notSentTodayLocal(sentAt: Date | null, timezone: string): boolean {
  if (!sentAt) return true;
  const today = localDateString(new Date(), timezone);
  return localDateString(sentAt, timezone) !== today;
}

export function localHourMinute(timezone: string): { hour: number; minute: number } | null {
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

export function inDeliveryWindow(
  hm: { hour: number; minute: number } | null,
  targetHour: number,
  deliveryWindowMinuteMax: number,
): boolean {
  if (!hm) return false;
  return hm.hour === targetHour && hm.minute <= deliveryWindowMinuteMax;
}
