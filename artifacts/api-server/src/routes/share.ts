/**
 * Share host routing for Universal/App Links and store fallbacks.
 *
 * Mounted at the root of the Express app (not under /api) so that
 * https://share.getpraying.com/post/123 opens the native app when installed,
 * or 302-redirects to the App Store / Play Store / marketing site when not.
 *
 * .well-known endpoints (AASA + assetlinks.json) enable iOS Universal Links
 * and Android App Links. Supply APPLE_TEAM_ID, APPLE_BUNDLE_ID,
 * ANDROID_PACKAGE_NAME, and ANDROID_CERT_FINGERPRINT when ready.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, appSettingsTable, usersTable, officialPrayersTable, prayerPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const APP_ORIGIN = (process.env.SHARE_WEB_ORIGIN ?? "https://share.getpraying.com").replace(/\/$/, "");
const API_PUBLIC_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.API_PUBLIC_BASE_URL ??
  "https://api.getpraying.com"
).replace(/\/$/, "");
const APP_NAME = "Get Praying";
const APP_SCHEME = "getpraying";
const MARKETING_URL = "https://getpraying.com";

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? "";
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.getpraying.app";
const ANDROID_PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME ?? "com.getpraying.app";
const ANDROID_CERT_FINGERPRINT = process.env.ANDROID_CERT_FINGERPRINT ?? "";

const IOS_STORE_URL = (process.env.IOS_STORE_URL ?? "").trim();
const ANDROID_STORE_URL = (process.env.ANDROID_STORE_URL ?? "").trim();

/** Fallback when `og_image_url` is unset in app_settings. */
const DEFAULT_OG_IMAGE_URL = `${APP_ORIGIN}/static/app-icon.png`;

type ClientPlatform = "ios" | "android" | "desktop";

function detectPlatform(userAgent: string): ClientPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function storeFallbackRedirect(req: Request, res: Response): void {
  const platform = detectPlatform(String(req.headers["user-agent"] ?? ""));
  let target = MARKETING_URL;
  if (platform === "ios" && IOS_STORE_URL) target = IOS_STORE_URL;
  else if (platform === "android" && ANDROID_STORE_URL) target = ANDROID_STORE_URL;
  res.redirect(302, target);
}

// ---------------------------------------------------------------------------
// Settings cache (60 s TTL)
// ---------------------------------------------------------------------------
let _settingsCache: Record<string, string> = {};
let _settingsCachedAt = 0;

async function getSettings(): Promise<Record<string, string>> {
  if (Date.now() - _settingsCachedAt < 60_000) return _settingsCache;
  try {
    const rows = await db.select().from(appSettingsTable);
    _settingsCache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    _settingsCachedAt = Date.now();
  } catch {
    /* keep stale cache */
  }
  return _settingsCache;
}

function resolveOgImageUrl(settings: Record<string, string>): string {
  const configured = settings.og_image_url?.trim();
  return normalizeOgImageUrl(configured || DEFAULT_OG_IMAGE_URL);
}

function normalizeOgImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_OG_IMAGE_URL;
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) {
    const host = trimmed.startsWith("/static/") ? APP_ORIGIN : API_PUBLIC_BASE;
    return `${host}${trimmed}`;
  }
  return `${API_PUBLIC_BASE}/${trimmed}`;
}

function resolveApiAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl?.trim()) return "";
  const value = pathOrUrl.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${API_PUBLIC_BASE}${value.startsWith("/") ? value : `/${value}`}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPage(opts: {
  title: string;
  description: string;
  ogImageUrl: string;
  canonicalUrl: string;
  deepLink: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  eyebrow: string;
  headline: string;
  body: string;
}): string {
  const { title, description, ogImageUrl, canonicalUrl, deepLink, iosStoreUrl, androidStoreUrl, eyebrow, headline, body } = opts;
  const imageUrl = normalizeOgImageUrl(ogImageUrl);

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="${esc(APP_NAME)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:secure_url" content="${esc(imageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
</head>
<body>
<p>Opening ${esc(APP_NAME)}…</p>
<script>
(function(){
  var isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
  var isAndroid=/Android/.test(navigator.userAgent);
  var deepLink=${JSON.stringify(deepLink)};
  var iosStore=${JSON.stringify(iosStoreUrl)};
  var androidStore=${JSON.stringify(androidStoreUrl)};
  window.location.href=deepLink;
  setTimeout(function(){
    var storeUrl=isIOS?iosStore:isAndroid?androidStore:'';
    if(storeUrl)window.location.href=storeUrl;
  },1500);
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route: shared post — pure redirect (no HTML). Universal Links open the app
// when installed; this handler only runs when the app is not on the device.
// ---------------------------------------------------------------------------
router.get("/post/:id", (req, res): void => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.redirect(302, MARKETING_URL);
    return;
  }
  storeFallbackRedirect(req, res);
});

// ---------------------------------------------------------------------------
// Route: Official guide share page  /official/:id
// ---------------------------------------------------------------------------
router.get("/official/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(404).send("Not found"); return; }

  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        id: officialPrayersTable.id,
        title: officialPrayersTable.title,
        subtitle: officialPrayersTable.subtitle,
        content: officialPrayersTable.content,
        category: officialPrayersTable.category,
      })
      .from(officialPrayersTable)
      .where(eq(officialPrayersTable.id, id))
      .limit(1),
  ]);

  const guide = rows[0];
  if (!guide) { res.status(404).send("Not found"); return; }

  const snippet = guide.content.slice(0, 200) + (guide.content.length > 200 ? "…" : "");
  const title = `${guide.title} — ${APP_NAME}`;
  const description = guide.subtitle ?? snippet;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl: resolveOgImageUrl(settings),
      canonicalUrl: `${APP_ORIGIN}/official/${id}`,
      deepLink: `${APP_SCHEME}://official/${id}`,
      iosStoreUrl: IOS_STORE_URL || settings.ios_app_store_url || "",
      androidStoreUrl: ANDROID_STORE_URL || settings.android_play_store_url || "",
      eyebrow: guide.category ?? "Guide",
      headline: guide.title,
      body: guide.subtitle ?? `A guided prayer on ${APP_NAME}`,
    }),
  );
});

// ---------------------------------------------------------------------------
// Route: Prayer path share page  /path/:id
// ---------------------------------------------------------------------------
router.get("/path/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(404).send("Not found"); return; }

  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        id: prayerPathsTable.id,
        name: prayerPathsTable.name,
        description: prayerPathsTable.description,
        tagline: prayerPathsTable.tagline,
        category: prayerPathsTable.category,
      })
      .from(prayerPathsTable)
      .where(eq(prayerPathsTable.id, id))
      .limit(1),
  ]);

  const path = rows[0];
  if (!path) { res.status(404).send("Not found"); return; }

  const title = `${path.name} — ${APP_NAME}`;
  const description = path.tagline ?? path.description.slice(0, 200);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl: resolveOgImageUrl(settings),
      canonicalUrl: `${APP_ORIGIN}/path/${id}`,
      deepLink: `${APP_SCHEME}://path/${id}`,
      iosStoreUrl: IOS_STORE_URL || settings.ios_app_store_url || "",
      androidStoreUrl: ANDROID_STORE_URL || settings.android_play_store_url || "",
      eyebrow: path.category ?? "Prayer Path",
      headline: path.name,
      body: path.tagline ?? path.description.slice(0, 160),
    }),
  );
});

// ---------------------------------------------------------------------------
// Route: User profile share page  /user/:username
// ---------------------------------------------------------------------------
router.get("/user/:username", async (req, res): Promise<void> => {
  const username = String(req.params.username ?? "").trim();
  if (!username) {
    res.status(404).send("Not found");
    return;
  }

  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        username: usersTable.username,
        displayName: usersTable.displayName,
        bio: usersTable.bio,
        avatarUrl: usersTable.avatarUrl,
        prayersShared: usersTable.prayersShared,
        isBanned: usersTable.isBanned,
      })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1),
  ]);

  const profile = rows[0];
  if (!profile || profile.isBanned) {
    res.status(404).send("Not found");
    return;
  }

  const displayName = profile.displayName?.trim() || profile.username;
  const bio = profile.bio?.trim() || `See prayers shared by ${displayName} on ${APP_NAME}.`;
  const title = `${displayName} on ${APP_NAME}`;
  const description = bio.slice(0, 200);
  const avatarOg = resolveApiAssetUrl(profile.avatarUrl);
  const ogImageUrl = avatarOg || resolveOgImageUrl(settings);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl,
      canonicalUrl: `${APP_ORIGIN}/user/${encodeURIComponent(profile.username)}`,
      deepLink: `${APP_SCHEME}://user/${profile.username}`,
      iosStoreUrl: IOS_STORE_URL || settings.ios_app_store_url || "",
      androidStoreUrl: ANDROID_STORE_URL || settings.android_play_store_url || "",
      eyebrow: "Profile",
      headline: displayName,
      body: `${profile.prayersShared} ${profile.prayersShared === 1 ? "prayer" : "prayers"} shared · @${profile.username}`,
    }),
  );
});

// ---------------------------------------------------------------------------
// .well-known/apple-app-site-association  (iOS Universal Links)
// ---------------------------------------------------------------------------
router.get("/.well-known/apple-app-site-association", (_req, res): void => {
  const appId =
    APPLE_TEAM_ID && APPLE_BUNDLE_ID ? `${APPLE_TEAM_ID}.${APPLE_BUNDLE_ID}` : "";

  res.setHeader("Content-Type", "application/json");
  res.json({
    applinks: {
      apps: [],
      details:
        appId !== ""
          ? [
              {
                appID: appId,
                paths: ["/post/*", "/official/*", "/path/*", "/user/*"],
              },
            ]
          : [],
    },
    webcredentials: {
      apps: appId !== "" ? [appId] : [],
    },
  });
});

// ---------------------------------------------------------------------------
// .well-known/assetlinks.json  (Android App Links)
// ---------------------------------------------------------------------------
router.get("/.well-known/assetlinks.json", (_req, res): void => {
  res.setHeader("Content-Type", "application/json");
  if (!ANDROID_CERT_FINGERPRINT || !ANDROID_PACKAGE_NAME) {
    res.json([]);
    return;
  }
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: [ANDROID_CERT_FINGERPRINT],
      },
    },
  ]);
});

export default router;
