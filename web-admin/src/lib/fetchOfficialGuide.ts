import { adminFetch } from "@/lib/api";

export type OfficialGuideRecord = {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
  category: string;
  pathId: number | null;
  scheduleSlot: string | null;
  scheduledDate?: string | null;
  isPremium?: boolean;
  tracks?: {
    id: number;
    title: string;
    description: string | null;
    audioUrl: string;
    orderIndex: number;
  }[];
};

/** Full guide payload (includes content) — use for edit forms, not list endpoints. */
export async function fetchOfficialGuide(
  token: string,
  id: number,
): Promise<OfficialGuideRecord | null> {
  const res = await adminFetch(`/library/official/${id}`, token);
  if (!res.ok) return null;
  return (await res.json()) as OfficialGuideRecord;
}
