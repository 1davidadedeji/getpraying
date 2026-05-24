import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiUrl, authHeaders } from "@/lib/api";

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

async function postPushTokenToServer(
  apiJwt: string,
  payload: { token: string | null; timezone?: string | null },
): Promise<void> {
  const body: { token: string | null; timezone?: string } = { token: payload.token };
  if (payload.token != null) {
    const tz =
      payload.timezone && payload.timezone.length > 0
        ? payload.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    body.timezone = tz;
  }
  await fetch(apiUrl("/users/me/push-token"), {
    method: "POST",
    headers: authHeaders(apiJwt, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * After Expo rotates the push token, persist it without calling `getExpoPushTokenAsync` again.
 */
export async function syncProvidedExpoPushToServer(apiJwt: string, expoToken: string): Promise<void> {
  if (!apiJwt || !Device.isDevice || !expoToken.trim()) return;
  await ensureAndroidNotificationChannel();
  await postPushTokenToServer(apiJwt, { token: expoToken.trim() });
}

export async function registerAndSyncPushToken(apiJwt: string | null): Promise<void> {
  if (!apiJwt || !Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }

  if (final !== "granted") {
    await postPushTokenToServer(apiJwt, { token: null });
    return;
  }

  await ensureAndroidNotificationChannel();

  const projectId = projectIdForExpoPush();
  const tokenRes = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const expoToken = tokenRes.data;

  await postPushTokenToServer(apiJwt, { token: expoToken });
}

export async function clearPushTokenOnServer(apiJwt: string | null): Promise<void> {
  if (!apiJwt) return;
  await postPushTokenToServer(apiJwt, { token: null });
}
