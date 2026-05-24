import { PUBLIC_WEB_ORIGIN } from "@/lib/publicWebOrigin";

/** Parsed in-app destination from a share or custom-scheme URL. */
export type ParsedDeepLink =
  | { kind: "post"; postId: number }
  | { kind: "official"; id: number }
  | { kind: "path"; id: number }
  | { kind: "user"; username: string };

const SHARE_HOSTS = new Set([
  new URL(PUBLIC_WEB_ORIGIN).host.toLowerCase(),
  "share.getpraying.com",
]);

function parsePathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/** Returns a deep-link target when `url` points at shared content, else null. */
export function parseDeepLinkUrl(url: string | null | undefined): ParsedDeepLink | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  if (trimmed.toLowerCase().startsWith("getpraying://")) {
    const pathPart = trimmed.slice("getpraying://".length).replace(/^\/+/, "");
    if (pathPart) {
      return parseDeepLinkUrl(`${PUBLIC_WEB_ORIGIN}/${pathPart}`);
    }
  }

  // Custom scheme: getpraying://post/123
  const schemeMatch = trimmed.match(/^getpraying:\/\/([^/?#]+)(?:\/([^/?#]*))?/i);
  if (schemeMatch) {
    const host = schemeMatch[1]?.toLowerCase();
    const rest = schemeMatch[2]?.trim();
    if (host === "post") {
      const id = Number.parseInt(rest ?? "", 10);
      if (Number.isFinite(id) && id > 0) return { kind: "post", postId: id };
    }
    if (host === "official" && rest) {
      const id = Number.parseInt(rest, 10);
      if (Number.isFinite(id) && id > 0) return { kind: "official", id };
    }
    if (host === "path" && rest) {
      const id = Number.parseInt(rest, 10);
      if (Number.isFinite(id) && id > 0) return { kind: "path", id };
    }
    if (host === "user" && rest) return { kind: "user", username: decodeURIComponent(rest) };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.host.toLowerCase();
  if (!SHARE_HOSTS.has(host) && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!SHARE_HOSTS.has(host)) return null;

  const segments = parsePathSegments(parsed.pathname);
  if (segments.length === 0) return null;

  const [head, second] = segments;
  if (head === "post" && second) {
    const postId = Number.parseInt(second, 10);
    if (Number.isFinite(postId) && postId > 0) return { kind: "post", postId };
  }
  if (head === "official" && second) {
    const id = Number.parseInt(second, 10);
    if (Number.isFinite(id) && id > 0) return { kind: "official", id };
  }
  if (head === "path" && second) {
    const id = Number.parseInt(second, 10);
    if (Number.isFinite(id) && id > 0) return { kind: "path", id };
  }
  if (head === "user" && second) {
    const username = decodeURIComponent(second).trim();
    if (username) return { kind: "user", username };
  }

  return null;
}

/** Expo Router href for a parsed deep link (post detail is the primary deferred target). */
export function deepLinkToHref(link: ParsedDeepLink): string {
  switch (link.kind) {
    case "post":
      return `/post/${link.postId}`;
    case "official":
      return `/official/${link.id}`;
    case "path":
      return `/path/${link.id}`;
    case "user":
      return `/user/${encodeURIComponent(link.username)}`;
  }
}
