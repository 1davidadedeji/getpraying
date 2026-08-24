import { fetchLibraryCached, peekLibraryCache } from "@/lib/libraryFetchCache";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { isSanctuaryOfficialPrayer } from "@/lib/premiumContent";
import { sanctuaryLibraryPath } from "@/lib/sanctuarySchedule";
import {
  beginSanctuaryFetch,
  isSanctuaryFetchStale,
} from "@/lib/sanctuaryFetchGuard";

export type SanctuaryState = {
  morning: OfficialPrayerRow | null;
  evening: OfficialPrayerRow | null;
};

type SanctuaryPayload = {
  morning?: OfficialPrayerRow | null;
  evening?: OfficialPrayerRow | null;
};

function normalizeSanctuaryPayload(data: SanctuaryPayload): SanctuaryState {
  return {
    morning: data.morning ?? null,
    evening: data.evening ?? null,
  };
}

/** Sanctuary slot guides should always ship audio — missing URL often means stale premium-stripped cache. */
export function sanctuarySlotMissingAudio(p: OfficialPrayerRow | null | undefined): boolean {
  if (!p?.id) return false;
  if (p.audioUrl?.trim()) return false;
  return isSanctuaryOfficialPrayer(p);
}

function payloadNeedsForceRefresh(data: SanctuaryPayload | null | undefined): boolean {
  if (!data) return false;
  return sanctuarySlotMissingAudio(data.morning) || sanctuarySlotMissingAudio(data.evening);
}

/** Fetch morning/evening sanctuary guides with stale-cache recovery for stripped audio. */
export async function loadSanctuaryState(
  token: string | null | undefined,
  opts?: { force?: boolean },
): Promise<SanctuaryState | null> {
  const generation = beginSanctuaryFetch(token);
  const path = sanctuaryLibraryPath();
  const force = opts?.force || payloadNeedsForceRefresh(peekLibraryCache<SanctuaryPayload>(path, token));

  const data = await fetchLibraryCached<SanctuaryPayload>(path, token, { force });
  if (isSanctuaryFetchStale(token, generation)) return null;
  if (!data) return { morning: null, evening: null };

  const state = normalizeSanctuaryPayload(data);
  if (!force && payloadNeedsForceRefresh(state)) {
    const retry = await fetchLibraryCached<SanctuaryPayload>(path, token, { force: true });
    if (isSanctuaryFetchStale(token, generation)) return null;
    if (retry) return normalizeSanctuaryPayload(retry);
  }

  return state;
}
