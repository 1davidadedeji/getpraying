const DEFAULT_API_BASE = "https://api.getpraying.com";

/** Resolved API origin; override with EXPO_PUBLIC_API_BASE_URL for local or staging APIs. */
export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}
