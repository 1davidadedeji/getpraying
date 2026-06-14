/**
 * Universal / App Links config for share.getpraying.com (Express share router).
 * Keep in sync with lib/app-links/assetlinks.json and web-admin/public/.well-known/assetlinks.json.
 */

export const ANDROID_PACKAGE_NAME_DEFAULT = "com.getpraying.app";

/** Play Store release + debug/preview signing certs. */
export const DEFAULT_ANDROID_SHA256_FINGERPRINTS = [
  "82FE0A0CC8BC181674EC05A0B8B5070035F2C99862595BC3CBEC34883EC24D93",
  "31:BC:7E:7D:CE:CB:D3:36:E8:BF:A8:83:AC:32:9A:9E:17:50:60:EB:44:1D:48:D1:56:17:13:BD:F8:2A:39:1C",
] as const;

/** Replace idXXXXXXXXX when the App Store listing is live. */
export const IOS_STORE_URL_PLACEHOLDER = "https://apps.apple.com/app/idXXXXXXXXX";

/** Play Store URL — update if using a custom listing slug. */
export const ANDROID_STORE_URL_PLACEHOLDER =
  "https://play.google.com/store/apps/details?id=com.getpraying.app";

function fingerprintKey(raw: string): string {
  return raw.replace(/:/g, "").toUpperCase();
}

/** Env ANDROID_CERT_FINGERPRINT (comma-separated) merged with repo defaults. */
export function resolveAndroidFingerprints(envValue: string | undefined): string[] {
  const fromEnv = (envValue ?? "")
    .split(/[,;\s]+/)
    .map((f) => f.trim())
    .filter(Boolean);

  const seen = new Set(fromEnv.map(fingerprintKey));
  const merged = [...fromEnv];

  for (const fp of DEFAULT_ANDROID_SHA256_FINGERPRINTS) {
    const key = fingerprintKey(fp);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(fp);
    }
  }

  return merged;
}

export function buildAssetLinksPayload(opts: {
  packageName: string;
  fingerprints: string[];
}): unknown[] {
  if (opts.fingerprints.length === 0 || !opts.packageName.trim()) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: opts.packageName.trim(),
        sha256_cert_fingerprints: opts.fingerprints,
      },
    },
  ];
}
