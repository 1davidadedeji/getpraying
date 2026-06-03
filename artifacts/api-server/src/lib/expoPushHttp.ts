/** Headers for Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/). */
export function expoPushRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken =
    process.env.EXPO_ACCESS_TOKEN?.trim() || process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export function expoPushAccessTokenConfigured(): boolean {
  return Boolean(
    process.env.EXPO_ACCESS_TOKEN?.trim() || process.env.EXPO_PUSH_ACCESS_TOKEN?.trim(),
  );
}
