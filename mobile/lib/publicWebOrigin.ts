/**
 * Public web origin used in share payloads and Universal Links / App Links.
 * `app.json` `ios.associatedDomains` / Android intent filters must use this host,
 * with `apple-app-site-association` + Digital Asset Links served at this domain for production opens.
 */
export const PUBLIC_WEB_ORIGIN = "https://share.getpraying.com";

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
