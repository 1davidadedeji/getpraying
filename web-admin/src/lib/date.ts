const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date as YYYY-MM-DD (matches mobile daily-word / sanctuary scheduling). */
export function formatLocalYMD(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when value is a valid YYYY-MM-DD calendar date. */
export function isValidYMD(value: string): boolean {
  const m = YMD_RE.exec(value.trim());
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Coerce API/DB values (YYYY-MM-DD or ISO timestamp) to YYYY-MM-DD for `<input type="date">`. */
export function normalizeScheduledDate(raw: unknown, fallback?: string): string {
  if (typeof raw === "string" && raw.trim()) {
    const trimmed = raw.trim();
    const ymd = YMD_RE.exec(trimmed);
    if (ymd) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return formatLocalYMD(parsed);
  }
  if (fallback && isValidYMD(fallback)) return fallback;
  return formatLocalYMD();
}

export function formatDisplayDate(ymd: string): string {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function scheduledDateStatus(ymd: string): "past" | "today" | "future" {
  const today = formatLocalYMD();
  if (ymd < today) return "past";
  if (ymd > today) return "future";
  return "today";
}
