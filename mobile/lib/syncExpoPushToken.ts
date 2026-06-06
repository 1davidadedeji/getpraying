import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";

const PUSH_BUILD_KEY = "@getpraying/push-build-fingerprint";
const EXPO_PUSH_TOKEN_PREFIX = "ExponentPushToken[";

export function isExpoPushToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith(EXPO_PUSH_TOKEN_PREFIX) && t.endsWith("]");
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F97316",
  });
}

function projectIdForExpoPush(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function currentBuildFingerprint(): string {
  const cfg = Constants.expoConfig;
  const buildNumber = cfg?.ios?.buildNumber ?? cfg?.android?.versionCode ?? "0";
  return [Platform.OS, buildNumber, Constants.executionEnvironment ?? "unknown"].join(":");
}

async function postPushTokenToServer(
  apiJwt: string,
  payload: {
    token: string | null;
    timezone?: string | null;
    platform?: string;
    buildFingerprint?: string;
  },
): Promise<boolean> {
  const body: Record<string, string | null> = { token: payload.token };
  if (payload.token != null) {
    const tz =
      payload.timezone && payload.timezone.length > 0
        ? payload.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    body.timezone = tz;
    body.platform = payload.platform ?? Platform.OS;
    if (payload.buildFingerprint) body.buildFingerprint = payload.buildFingerprint;
  }
  const res = await apiFetch("/users/me/push-token", {
    method: "POST",
    token: apiJwt,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn("[push] server rejected token sync:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

/**
 * After Expo rotates the push token, persist it without calling `getExpoPushTokenAsync` again.
 */
export async function syncProvidedExpoPushToServer(apiJwt: string, expoToken: string): Promise<void> {
  if (!apiJwt || !Device.isDevice || !expoToken.trim()) return;
  if (!isExpoPushToken(expoToken)) {
    // Native FCM/APNs rotation events are not Expo tokens — fetch the real Expo token.
    await registerAndSyncPushToken(apiJwt);
    return;
  }
  await ensureAndroidNotificationChannel();
  await postPushTokenToServer(apiJwt, {
    token: expoToken.trim(),
    platform: Platform.OS,
    buildFingerprint: currentBuildFingerprint(),
  });
}

export async function registerAndSyncPushToken(apiJwt: string | null): Promise<void> {
  if (!apiJwt || !Device.isDevice) return;

  await ensureAndroidNotificationChannel();

  // Check / request permission first. Only send null when the user has explicitly
  // denied permission — not on transient FCM/APNs failures.
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
      android: {},
    });
    final = status;
  }

  if (final !== "granted") {
    console.warn("[push] notification permission not granted:", final);
    await postPushTokenToServer(apiJwt, { token: null });
    return;
  }

  // Resolve the Expo push token. On failure keep the existing server token intact so
  // the user doesn't lose notifications just because FCM/APNs was briefly unavailable.
  const buildFingerprint = currentBuildFingerprint();
  try {
    const projectId = projectIdForExpoPush();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoToken = tokenRes.data?.trim() ?? "";
    if (!isExpoPushToken(expoToken)) {
      // Unexpected format — log and bail without clearing the old server token.
      console.warn("[push] unexpected token format from getExpoPushTokenAsync:", expoToken.slice(0, 40));
      return;
    }
    const ok = await postPushTokenToServer(apiJwt, {
      token: expoToken,
      platform: Platform.OS,
      buildFingerprint,
    });
    if (ok) await AsyncStorage.setItem(PUSH_BUILD_KEY, buildFingerprint);
  } catch (err) {
    // Transient failure (FCM/APNs unavailable, no network, etc.).
    // Do NOT clear the server token — the existing one may still be valid.
    // The token will be re-registered on the next foreground or login event.
    console.warn("[push] getExpoPushTokenAsync failed:", err);
  }
}

export async function clearPushTokenOnServer(apiJwt: string | null): Promise<void> {
  if (!apiJwt) return;
  await postPushTokenToServer(apiJwt, { token: null });
}
