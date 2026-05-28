/** Default pill label for guided official prayers (path cards, detail, library). */
export const OFFICIAL_PRAYER_BADGE = "Official Prayer";

/** Row from GET /library/official, sanctuary, path detail, or /library/saved-official */
export type OfficialPrayerRow = {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
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
};
