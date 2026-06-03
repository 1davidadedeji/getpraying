import AsyncStorage from "@react-native-async-storage/async-storage";

const HANDLED_RESPONSE_KEY = "@getpraying/handled_notification_response_id";

/** In-memory dedup for the current JS session (cold-start listener + getLastNotificationResponse). */
const handledInSession = new Set<string>();

/**
 * Returns true when this notification response should be handled.
 * Persists cold-start id so `getLastNotificationResponseAsync` is not replayed on every launch.
 */
export async function claimNotificationResponseId(id: string): Promise<boolean> {
  if (!id) return false;
  if (handledInSession.has(id)) return false;

  try {
    const prev = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY);
    if (prev === id) return false;
    await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, id);
  } catch {
    /* still handle in-session */
  }

  handledInSession.add(id);
  return true;
}

/** Foreground/background taps: dedupe duplicate listener delivery in one session. */
export function claimNotificationResponseInSession(id: string): boolean {
  if (!id || handledInSession.has(id)) return false;
  handledInSession.add(id);
  return true;
}
