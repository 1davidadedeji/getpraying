/** Send null when scripture is blank so the API treats it as optional. */
export function scriptureForApi(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Prefer explicit description; fall back to subtitle/title for legacy rows. */
export function contentForApi(raw: string | null | undefined, ...fallbacks: (string | null | undefined)[]): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > 0) return trimmed;
  for (const f of fallbacks) {
    const t = typeof f === "string" ? f.trim() : "";
    if (t.length > 0) return t;
  }
  return "";
}
