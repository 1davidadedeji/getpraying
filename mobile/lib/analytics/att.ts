import { Platform } from "react-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

/** Request ATT on iOS; returns whether tracking was granted. Android always true. */
export async function requestAttIfNeeded(): Promise<boolean> {
  if (Platform.OS !== "ios") return true;
  try {
    const { status } = await requestTrackingPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}
