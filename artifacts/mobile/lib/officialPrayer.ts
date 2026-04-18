/** Row from GET /library/official */
export type OfficialPrayerRow = {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  category: string;
  label: string | null;
  scheduleSlot: string | null;
  uploadedByUsername: string | null;
  uploadedByDisplayName: string | null;
};
