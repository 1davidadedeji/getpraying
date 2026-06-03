/** Default pill label for guided official prayers (path cards, detail, library). */
export const OFFICIAL_PRAYER_BADGE = "Official Prayer";

/** Replace legacy "Official Sanctuary" badge copy from older CMS rows. */
export function normalizeOfficialGuideLabel(label: string | null | undefined): string {
  const trimmed = typeof label === "string" ? label.trim() : "";
  if (!trimmed) return OFFICIAL_PRAYER_BADGE;
  const fixed = trimmed.replace(/official\s+sanctuary/gi, OFFICIAL_PRAYER_BADGE);
  return fixed.trim() || OFFICIAL_PRAYER_BADGE;
}

/** Uppercase badge line for cards and detail headers. */
export function officialGuideBadgeLabel(label: string | null | undefined): string {
  return normalizeOfficialGuideLabel(label).toUpperCase();
}

export type LectureTrackRow = {
  id: number;
  title: string;
  audioUrl: string;
  description?: string | null;
  orderIndex: number;
};

/** Row from GET /library/official, sanctuary, path detail, or /library/saved-official */
export type OfficialPrayerRow = {
  id: number;
  title: string;
  subtitle: string | null;
  /** Omitted on list endpoints; present on GET /library/official/:id. */
  content?: string | null;
  category: string;
  label: string | null;
  scheduleSlot: string | null;
  pathId: number | null;
  uploadedByUsername: string | null;
  uploadedByDisplayName: string | null;
  scripture?: string | null;
  audioUrl?: string | null;
  durationMinutes?: number | null;
  createdAt?: string | Date | null;
  /** Present on lecture rows (`category === "lectures"`). */
  tracks?: LectureTrackRow[];
};
