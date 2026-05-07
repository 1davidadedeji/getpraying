/** Best-effort Open Graph parsing for lightweight in-app link previews (native fetch, no DOM). */

const HTTPS_RE = /https:\/\/[^\s<>"'`[\]()]+/gi;

export type LinkPreview = {
  url: string;
  title: string | null;
  imageUrl: string | null;
};

export function decodeBasicHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

/** Strip trailing punctuation often glued to URLs in prose. */
function stripTrailingMarks(href: string): string {
  return href.replace(/[),.;:!?'[\]>]+\s*$/g, "");
}

/** First syntactically valid https:// URL in text, if any. */
export function extractFirstHttpsUrl(text: string): string | undefined {
  if (!text) return undefined;
  HTTPS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HTTPS_RE.exec(text)) !== null) {
    let href = stripTrailingMarks(m[0]);
    try {
      const u = new URL(href);
      if (u.protocol !== "https:") continue;
      return u.href;
    } catch {
      /* next */
    }
  }
  return undefined;
}

function pickMeta(html: string, property: string): string | null {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rePropFirst = new RegExp(
    `<meta[^>]+property=["']${esc}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const reContentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${esc}["']`,
    "i",
  );
  const m = html.match(rePropFirst) ?? html.match(reContentFirst);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  return decodeBasicHtmlEntities(raw);
}

function pickTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = m?.[1]?.replace(/\s+/g, " ")?.trim();
  if (!raw) return null;
  return decodeBasicHtmlEntities(raw);
}

function resolveUrl(baseHref: string, maybeRelative: string): string | null {
  try {
    return new URL(maybeRelative.trim(), baseHref).href;
  } catch {
    return null;
  }
}

/** Resolve protocol-relative and path-only Open Graph image URLs to https. */
function normalizeOgImageHref(raw: string | null, pageUrl: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^https:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) {
    try {
      return new URL(`https:${t}`).href;
    } catch {
      return null;
    }
  }
  const resolved = resolveUrl(pageUrl, t);
  return resolved && /^https:\/\//i.test(resolved) ? resolved : null;
}

/** Fetch HTML and parse og:title / og:image (fallback: <title>). */
export async function fetchOpenGraphPreview(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<LinkPreview | null> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        /** Many CDNs behave better with a common desktop UA when scraping OG tags. */
        "User-Agent": "Mozilla/5.0 (compatible; GetPraying/1.0; +https://getpraying.app)",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html) return null;

    const baseForRelative =
      typeof res.url === "string" && res.url.startsWith("http") ? res.url : url;

    const ogTitle = pickMeta(html, "og:title") ?? pickMeta(html, "twitter:title") ?? pickTitleTag(html);

    let imageRaw =
      pickMeta(html, "og:image") ??
      pickMeta(html, "og:image:url") ??
      pickMeta(html, "twitter:image") ??
      pickMeta(html, "twitter:image:src");

    // Some sites expose secure_url separately
    if (!imageRaw) imageRaw = pickMeta(html, "og:image:secure_url");

    const imageUrl = normalizeOgImageHref(imageRaw, baseForRelative);

    if (!ogTitle && !imageUrl) return null;

    return {
      url: baseForRelative,
      title: ogTitle,
      imageUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
