import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import { isPushDeliveryEnabled } from "@/lib/pushDeliveryGate";

export { isPushDeliveryEnabled, setPushDeliveryEnabled } from "@/lib/pushDeliveryGate";

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
    shouldShowAlert: isPushDeliveryEnabled(),
    shouldPlaySound: isPushDeliveryEnabled(),
    shouldSetBadge: isPushDeliveryEnabled(),
    shouldShowBanner: isPushDeliveryEnabled(),
    shouldShowList: isPushDeliveryEnabled(),
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

let inflightSync: Promise<boolean> | null = null;
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
  opts?: { force?: boolean },
): Promise<boolean> {
  const buildFingerprint = payload.buildFingerprint ?? "";
  if (!opts?.force && matchesLastPosted(apiJwt, payload.token, buildFingerprint)) {
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
export async function syncProvidedExpoPushToServer(apiJwt: string, expoToken: string): Promise<boolean> {
  if (!apiJwt || !Device.isDevice || !expoToken.trim()) return false;
  if (!isExpoPushToken(expoToken)) {
    return registerAndSyncPushToken(apiJwt);
  }
  await ensureAndroidNotificationChannel();
  return postPushTokenToServer(apiJwt, {
    token: expoToken.trim(),
    platform: Platform.OS,
    buildFingerprint: currentBuildFingerprint(),
  });
}

export async function registerAndSyncPushToken(
  apiJwt: string | null,
  opts?: { force?: boolean },
): Promise<boolean> {
  if (!apiJwt || !Device.isDevice) return false;

  if (BYPASS_PUSH_TOKEN_SYNC) {
    console.info("[push] BYPASS_PUSH_TOKEN_SYNC — skipping registerAndSyncPushToken (ios boot test)");
    return false;
  }

  if (inflightSync && inflightSyncJwt === apiJwt) {
    return inflightSync.then(() => lastPosted?.jwt === apiJwt && lastPosted.token != null);
  }

  const run = async (): Promise<boolean> => {
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
      if (!opts?.force && matchesLastPosted(apiJwt, null, "")) {
        return true;
      }
      return postPushTokenToServer(apiJwt, { token: null }, opts);
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
        return false;
      }
      if (!opts?.force && matchesLastPosted(apiJwt, expoToken, buildFingerprint)) {
        return true;
      }
      const ok = await postPushTokenToServer(
        apiJwt,
        {
          token: expoToken,
          platform: Platform.OS,
          buildFingerprint,
        },
        opts,
      );
      if (ok) await AsyncStorage.setItem(PUSH_BUILD_KEY, buildFingerprint);
      return ok;
    } catch (err) {
      console.warn("[push] getExpoPushTokenAsync failed:", err);
      return false;
    }
  };

  inflightSyncJwt = apiJwt;
  const pending = run().finally(() => {
    if (inflightSyncJwt === apiJwt) {
      inflightSync = null;
      inflightSyncJwt = null;
    }
  });
  inflightSync = pending;
  return pending;
}

/** Re-register token + timezone with the API (e.g. on every foreground). */
export async function refreshPushRegistration(apiJwt: string | null): Promise<boolean> {
  if (!apiJwt) return false;
  return registerAndSyncPushToken(apiJwt, { force: true });
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
