import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";

const PUSH_BUILD_KEY = "@getpraying/push-build-fingerprint";
const EXPO_PUSH_TOKEN_PREFIX = "ExponentPushToken[";

/**
 * Registers the device Expo push token with the API (permission + getExpoPushTokenAsync).
 */
export const BYPASS_PUSH_TOKEN_SYNC = false;

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

export function currentBuildFingerprint(): string {
  const cfg = Constants.expoConfig;
  const buildNumber = cfg?.ios?.buildNumber ?? cfg?.android?.versionCode ?? "0";
  return [Platform.OS, buildNumber, Constants.executionEnvironment ?? "unknown"].join(":");
}

type PostedPushSnapshot = {
  jwt: string;
  token: string | null;
  buildFingerprint: string;
};

let inflightSync: Promise<void> | null = null;
let inflightSyncJwt: string | null = null;
let lastPosted: PostedPushSnapshot | null = null;

function matchesLastPosted(jwt: string, token: string | null, buildFingerprint: string): boolean {
  if (!lastPosted) return false;
  return (
    lastPosted.jwt === jwt &&
    lastPosted.token === token &&
    lastPosted.buildFingerprint === buildFingerprint
  );
}

/** Clear in-memory sync dedupe state (e.g. after logout). */
export function resetPushTokenSyncState(): void {
  inflightSync = null;
  inflightSyncJwt = null;
  lastPosted = null;
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
  const buildFingerprint = payload.buildFingerprint ?? "";
  if (matchesLastPosted(apiJwt, payload.token, buildFingerprint)) {
    return true;
  }

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
  lastPosted = { jwt: apiJwt, token: payload.token, buildFingerprint };
  return true;
}

/**
 * After Expo rotates the push token, persist it without calling `getExpoPushTokenAsync` again.
 */
export async function syncProvidedExpoPushToServer(apiJwt: string, expoToken: string): Promise<void> {
  if (!apiJwt || !Device.isDevice || !expoToken.trim()) return;
  if (!isExpoPushToken(expoToken)) {
    // Native APNs/FCM rotation events are not Expo tokens — fetch once via guarded register.
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

  if (BYPASS_PUSH_TOKEN_SYNC) {
    console.info("[push] BYPASS_PUSH_TOKEN_SYNC — skipping registerAndSyncPushToken (ios boot test)");
    return;
  }

  if (inflightSync && inflightSyncJwt === apiJwt) {
    return inflightSync;
  }

  const run = async (): Promise<void> => {
    await ensureAndroidNotificationChannel();

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
      if (!matchesLastPosted(apiJwt, null, "")) {
        await postPushTokenToServer(apiJwt, { token: null });
      }
      return;
    }

    const buildFingerprint = currentBuildFingerprint();
    try {
      const projectId = projectIdForExpoPush();
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const expoToken = tokenRes.data?.trim() ?? "";
      if (!isExpoPushToken(expoToken)) {
        console.warn("[push] unexpected token format from getExpoPushTokenAsync:", expoToken.slice(0, 40));
        return;
      }
      if (matchesLastPosted(apiJwt, expoToken, buildFingerprint)) {
        return;
      }
      const ok = await postPushTokenToServer(apiJwt, {
        token: expoToken,
        platform: Platform.OS,
        buildFingerprint,
      });
      if (ok) await AsyncStorage.setItem(PUSH_BUILD_KEY, buildFingerprint);
    } catch (err) {
      console.warn("[push] getExpoPushTokenAsync failed:", err);
    }
  };

  inflightSyncJwt = apiJwt;
  inflightSync = run().finally(() => {
    if (inflightSyncJwt === apiJwt) {
      inflightSync = null;
      inflightSyncJwt = null;
    }
  });
  return inflightSync;
}

/** Whether the app build changed since the last successful push-token sync. */
export async function pushTokenNeedsBuildResync(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PUSH_BUILD_KEY);
  return stored !== currentBuildFingerprint();
}

export async function clearPushTokenOnServer(apiJwt: string | null): Promise<void> {
  if (!apiJwt) return;
  resetPushTokenSyncState();
  await postPushTokenToServer(apiJwt, { token: null });
  await AsyncStorage.removeItem(PUSH_BUILD_KEY).catch(() => {});
}
