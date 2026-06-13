import { parseCalendarDateString } from "./dailyWordCatalog";

export function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
