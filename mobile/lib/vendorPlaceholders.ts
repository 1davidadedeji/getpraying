export type EnvMap = Record<string, string | undefined>;

export type ExpoPluginEntry = string | [string, Record<string, unknown>];

const ZERO_AIZA_KEY = /^AIzaSy0+$/i;
const META_DUMMY_APP_ID = "123456789012345";
const DUMMY_GCM_SENDERS = new Set(["123456789012", "123456789012", "123456789012"]);

export function isPlaceholderGoogleApiKey(key: string): boolean {
  const value = key.trim();
  if (!value.startsWith("AIza") || value.length < 30) return true;
  if (ZERO_AIZA_KEY.test(value)) return true;
  return /dummy|placeholder|replaceme|replace_me/i.test(value);
}

export function isPlaceholderFirebaseProjectId(projectId: string): boolean {
  const value = projectId.trim();
  if (!value) return true;
  return /dummy|placeholder/i.test(value);
}

export function isPlaceholderGcmSenderId(senderId: string): boolean {
  const value = senderId.trim();
  if (!/^\d{6,}$/.test(value)) return true;
  return DUMMY_GCM_SENDERS.has(value) || /^0+$/.test(value);
}

export function isPlaceholderGoogleAppId(appId: string): boolean {
  const value = appId.trim();
  if (!/^1:\d+:ios:[a-f0-9]{8,}$/i.test(value)) return true;
  if ([...DUMMY_GCM_SENDERS].some((sender) => value.includes(`1:${sender}:`))) return true;
  const hex = value.split(":")[3] ?? "";
  return /^0+1?$/i.test(hex);
}

export function isPlaceholderMetaAppId(appId: string): boolean {
  const value = appId.trim();
  if (!/^\d{8,}$/.test(value)) return true;
  return value === META_DUMMY_APP_ID;
}

export function isPlaceholderMetaClientToken(token: string): boolean {
  const value = token.trim();
  if (value.length < 8) return true;
  return /dummy|placeholder|replace_before|replace me/i.test(value);
}

export function iosGoogleAppIdFromAndroidAppId(androidAppId: string): string {
  const match = androidAppId.trim().match(/^1:(\d+):android:([a-f0-9]+)$/i);
  if (!match) return "";
  return `1:${match[1]}:ios:${match[2]}`;
}

export function plistStringValue(plist: string, key: string): string {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1] ?? "";
}

export function metaPluginFromEnv(env: EnvMap): ExpoPluginEntry[] {
  const appID = env.EXPO_PUBLIC_META_APP_ID?.trim() ?? "";
  const clientToken = env.EXPO_PUBLIC_META_CLIENT_TOKEN?.trim() ?? "";
  if (isPlaceholderMetaAppId(appID) || isPlaceholderMetaClientToken(clientToken)) {
    return [];
  }
  return [
    [
      "react-native-fbsdk-next",
      {
        appID,
        clientToken,
        displayName: "Get Praying",
        scheme: `fb${appID}`,
        advertiserIDCollectionEnabled: true,
        autoLogAppEventsEnabled: true,
        iosUserTrackingPermission:
          "This allows us to optimize your experience and measure ad performance.",
      },
    ],
  ];
}
