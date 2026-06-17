/** Normalize Expo Router dynamic segment params (string | string[] | undefined). */
export function normalizeRouteStringParam(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return decodeURIComponent(v.trim());
  } catch {
    return v.trim();
  }
}
