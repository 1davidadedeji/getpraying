/**
 * Share / deep-link redirect pages.
 *
 * Mounted at the root of the Express app (not under /api) so that
 * https://share.getpraying.com/post/123  →  OG-tagged HTML page that tries to
 * open the app and falls back to the appropriate app store.
 *
 * Store URLs live in `app_settings` (keys: ios_app_store_url,
 * android_play_store_url).  Changes take effect within ~60 s without any
 * server restart or app rebuild.
 *
 * .well-known endpoints (AASA + assetlinks.json) enable iOS Universal Links
 * and Android App Links.  Supply APPLE_TEAM_ID and ANDROID_CERT_FINGERPRINT
 * env vars to make them functional; they return valid-but-empty configs when
 * the env vars are absent so the routes still respond correctly.
 */
import { Router, type IRouter } from "express";
import { db, appSettingsTable, postsTable, usersTable, officialPrayersTable, prayerPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const APP_ORIGIN = "https://share.getpraying.com";
const APP_NAME = "Get Praying";
const APP_SCHEME = "getpraying";
const BUNDLE_ID = "com.getpraying.app";
const PACKAGE_NAME = "com.getpraying.app";
/** Fallback when `og_image_url` is unset in app_settings. */
const DEFAULT_OG_IMAGE_URL = `${APP_ORIGIN}/static/app-icon.png`;

// ---------------------------------------------------------------------------
// Settings cache (60 s TTL — changes to store URLs need no server restart)
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
    // keep stale cache on DB error rather than crashing
  }
  return _settingsCache;
}

function resolveOgImageUrl(settings: Record<string, string>): string {
  const configured = settings.og_image_url?.trim();
  return configured || DEFAULT_OG_IMAGE_URL;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
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
  const hasImage = ogImageUrl.length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="${esc(APP_NAME)}">
${hasImage ? `<meta property="og:image" content="${esc(ogImageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="${hasImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${hasImage ? `<meta name="twitter:image" content="${esc(ogImageUrl)}">` : ""}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F6F0;color:#1A1F36}
.wrap{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;gap:24px}
.logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#1A1F36}
.logo span{color:#7C6B52}
.card{background:#fff;border-radius:16px;padding:28px 24px;max-width:480px;width:100%;box-shadow:0 2px 16px rgba(26,31,54,.07)}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9CA0B0;margin-bottom:8px}
.headline{font-size:19px;font-weight:700;line-height:1.35;color:#1A1F36;margin-bottom:10px}
.body{font-size:15px;line-height:1.6;color:#4B5163;margin-bottom:0}
.actions{display:flex;flex-direction:column;gap:10px;max-width:480px;width:100%}
.btn{display:block;width:100%;padding:15px 24px;border-radius:12px;font-size:16px;font-weight:600;text-align:center;text-decoration:none;cursor:pointer;border:none;transition:opacity .15s}
.btn-primary{background:#1A1F36;color:#fff}
.btn-primary:hover{opacity:.88}
.btn-secondary{background:#fff;color:#1A1F36;border:1.5px solid #D8D5CF}
.btn-secondary:hover{background:#F0EDE8}
.store-row{display:flex;gap:10px;justify-content:center}
.store-row .btn{flex:1}
.footer{font-size:12px;color:#B0ADA8;text-align:center;padding-top:8px}
#status{font-size:13px;color:#9CA0B0;text-align:center;margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">${esc(APP_NAME)}</div>
  <div class="card">
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <div class="headline">${esc(headline)}</div>
    <div class="body">${esc(body)}</div>
  </div>
  <div class="actions">
    <a id="open-btn" class="btn btn-primary" href="${esc(deepLink)}">Open in ${esc(APP_NAME)}</a>
    <div id="store-row" class="store-row" style="display:none">
      ${iosStoreUrl ? `<a class="btn btn-secondary" href="${esc(iosStoreUrl)}" id="ios-btn">App Store</a>` : ""}
      ${androidStoreUrl ? `<a class="btn btn-secondary" href="${esc(androidStoreUrl)}" id="android-btn">Google Play</a>` : ""}
    </div>
    <div id="status"></div>
  </div>
  <p class="footer">Get Praying &mdash; a community of prayer</p>
</div>
<script>
(function(){
  var isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
  var isAndroid=/Android/.test(navigator.userAgent);
  var deepLink=${JSON.stringify(deepLink)};
  var iosStore=${JSON.stringify(iosStoreUrl)};
  var androidStore=${JSON.stringify(androidStoreUrl)};

  // Show the correct store button for this platform
  if(isIOS&&iosStore||isAndroid&&androidStore){
    document.getElementById('store-row').style.display='flex';
    if(isIOS&&!iosStore)document.getElementById('ios-btn')&&document.getElementById('ios-btn').remove();
    if(isAndroid&&!androidStore)document.getElementById('android-btn')&&document.getElementById('android-btn').remove();
  }

  // Auto-attempt deep link then fall back to store
  var hidden=false;
  document.addEventListener('visibilitychange',function(){if(document.hidden)hidden=true;});

  var statusEl=document.getElementById('status');
  function setStatus(t){if(statusEl)statusEl.textContent=t;}

  // Give the page 800 ms to settle before trying (avoids partial render)
  setTimeout(function(){
    setStatus('Opening app…');
    window.location.href=deepLink;
    setTimeout(function(){
      if(hidden)return; // app opened
      var storeUrl=isIOS?iosStore:isAndroid?androidStore:'';
      if(storeUrl){
        setStatus('App not found — redirecting to store…');
        setTimeout(function(){window.location.href=storeUrl;},600);
      }else{
        setStatus('Download the app to open this link.');
      }
    },2000);
  },800);
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route: POST share page  /post/:id
// ---------------------------------------------------------------------------
router.get("/post/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(404).send("Not found"); return; }

  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        prayCount: postsTable.prayCount,
        isAnonymous: postsTable.isAnonymous,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(postsTable.id, id))
      .limit(1),
  ]);

  const post = rows[0];
  if (!post) { res.status(404).send("Not found"); return; }

  const snippet = post.content.slice(0, 240) + (post.content.length > 240 ? "…" : "");
  const author = post.isAnonymous ? "Anonymous" : (post.authorDisplayName ?? post.authorUsername ?? "Someone");
  const title = `"${snippet.slice(0, 80)}${snippet.length > 80 ? "…" : ""}" — ${APP_NAME}`;
  const description = `${author} shared a prayer on ${APP_NAME}. ${post.prayCount} ${post.prayCount === 1 ? "person" : "people"} praying.`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl: resolveOgImageUrl(settings),
      canonicalUrl: `${APP_ORIGIN}/post/${id}`,
      deepLink: `${APP_SCHEME}://post/${id}`,
      iosStoreUrl: settings.ios_app_store_url ?? "",
      androidStoreUrl: settings.android_play_store_url ?? "",
      eyebrow: "Prayer",
      headline: `“${snippet.slice(0, 120)}${snippet.length > 120 ? "…" : ""}”`,
      body: `Shared by ${author} · ${post.prayCount} ${post.prayCount === 1 ? "person" : "people"} praying`,
    }),
  );
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
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl: resolveOgImageUrl(settings),
      canonicalUrl: `${APP_ORIGIN}/official/${id}`,
      deepLink: `${APP_SCHEME}://official/${id}`,
      iosStoreUrl: settings.ios_app_store_url ?? "",
      androidStoreUrl: settings.android_play_store_url ?? "",
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
  res.send(
    buildPage({
      title,
      description,
      ogImageUrl: resolveOgImageUrl(settings),
      canonicalUrl: `${APP_ORIGIN}/path/${id}`,
      deepLink: `${APP_SCHEME}://path/${id}`,
      iosStoreUrl: settings.ios_app_store_url ?? "",
      androidStoreUrl: settings.android_play_store_url ?? "",
      eyebrow: path.category ?? "Prayer Path",
      headline: path.name,
      body: path.tagline ?? path.description.slice(0, 160),
    }),
  );
});

// ---------------------------------------------------------------------------
// .well-known/apple-app-site-association  (iOS Universal Links)
//
// Requires env var APPLE_TEAM_ID (e.g. "AB12CD34EF").
// Without it, returns an empty-paths config so the file is still valid JSON
// and won't cause 404 errors during app notarisation / review.
// ---------------------------------------------------------------------------
router.get("/.well-known/apple-app-site-association", (_req, res): void => {
  const teamId = process.env.APPLE_TEAM_ID ?? "";
  const appId = teamId ? `${teamId}.${BUNDLE_ID}` : BUNDLE_ID;

  res.setHeader("Content-Type", "application/json");
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: appId,
          paths: ["/post/*", "/official/*", "/path/*", "/user/*"],
        },
      ],
    },
    webcredentials: {
      apps: [appId],
    },
  });
});

// ---------------------------------------------------------------------------
// .well-known/assetlinks.json  (Android App Links)
//
// Requires env var ANDROID_CERT_FINGERPRINT — the SHA-256 of your release
// signing certificate (colon-separated hex, e.g. from `keytool -list`).
// Without it, returns an empty array (still valid JSON, no 404).
// ---------------------------------------------------------------------------
router.get("/.well-known/assetlinks.json", (_req, res): void => {
  const fingerprint = process.env.ANDROID_CERT_FINGERPRINT ?? "";
  res.setHeader("Content-Type", "application/json");
  if (!fingerprint) {
    res.json([]);
    return;
  }
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ]);
});

export default router;
