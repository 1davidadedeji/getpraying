import AsyncStorage from "@react-native-async-storage/async-storage";

const HANDLED_RESPONSE_KEY = "@getpraying/handled_notification_response_id";

/**
 * Returns true when this notification response id has not been handled in a prior app session.
 * Persists the id so `getLastNotificationResponseAsync` is not replayed on every cold start.
 */
export async function claimNotificationResponseId(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const prev = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY);
    if (prev === id) return false;
    await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, id);
    return true;
  } catch {
    return true;
  }
}
