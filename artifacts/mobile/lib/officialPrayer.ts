/** Row from GET /library/official or /library/saved-official */
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
};
