/** Canonical badge copy for guided official prayers (path guides, sanctuary slots, library). */
export const OFFICIAL_PRAYER_LABEL = "Official Prayer";

/** Replace legacy "Official Sanctuary" copy; keep optional slot suffixes (e.g. " · MORNING"). */
export function normalizeOfficialGuideLabel(label: string | null | undefined): string {
  const trimmed = typeof label === "string" ? label.trim() : "";
  if (!trimmed) return OFFICIAL_PRAYER_LABEL;
  const fixed = trimmed.replace(/official\s+sanctuary/gi, OFFICIAL_PRAYER_LABEL);
  return fixed.trim() || OFFICIAL_PRAYER_LABEL;
}

/** Label for new rows when the client omits one (morning/evening slot or legacy sanctuary category). */
export function defaultOfficialGuideLabel(opts: {
  scheduleSlot?: string | null;
  category?: string | null;
  bodyLabel?: unknown;
}): string | null {
  if (typeof opts.bodyLabel === "string" && opts.bodyLabel.trim()) {
    return normalizeOfficialGuideLabel(opts.bodyLabel);
  }
  const slot = opts.scheduleSlot?.trim().toLowerCase();
  const category = opts.category?.trim().toLowerCase();
  if (slot === "morning" || slot === "evening" || category === "sanctuary") {
    return OFFICIAL_PRAYER_LABEL;
  }
  return null;
}
