/**
 * Public web origin used in share payloads and Universal Links / App Links.
 * Must match a host that serves share HTML + `.well-known/*` (see api-server share router).
 * Production currently serves these routes on `api.getpraying.com`; point
 * `EXPO_PUBLIC_SHARE_WEB_ORIGIN` at `https://share.getpraying.com` once that subdomain
 * proxies to the same Node process.
 */
export const PUBLIC_WEB_ORIGIN = (
  process.env.EXPO_PUBLIC_SHARE_WEB_ORIGIN ?? "https://api.getpraying.com"
).replace(/\/$/, "");

/** HTTPS URL that opens `/post/[id]` in-app when Universal Links / App Links are configured. */
export function postShareUrl(postId: number): string {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) return PUBLIC_WEB_ORIGIN;
  return `${PUBLIC_WEB_ORIGIN}/post/${id}`;
}

/** HTTPS URL that opens `/official/[id]` (guided prayer) in-app. */
export function officialShareUrl(guideId: number): string {
  const id = Number(guideId);
  if (!Number.isFinite(id) || id <= 0) return PUBLIC_WEB_ORIGIN;
  return `${PUBLIC_WEB_ORIGIN}/official/${id}`;
}

/** HTTPS URL that opens `/path/[id]` (prayer path) in-app. */
export function pathShareUrl(pathId: number): string {
  const id = Number(pathId);
  if (!Number.isFinite(id) || id <= 0) return PUBLIC_WEB_ORIGIN;
  return `${PUBLIC_WEB_ORIGIN}/path/${id}`;
}

/** HTTPS URL that opens `/user/[username]` in-app. */
export function userShareUrl(username: string): string {
  const handle = username.trim();
  if (!handle) return PUBLIC_WEB_ORIGIN;
  return `${PUBLIC_WEB_ORIGIN}/user/${encodeURIComponent(handle)}`;
}
