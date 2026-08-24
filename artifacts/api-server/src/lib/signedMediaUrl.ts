import crypto from "node:crypto";

const DEFAULT_TTL_SEC = 4 * 60 * 60;

type SignedMediaPayload = {
  p: string;
  exp: number;
  sig: string;
};

export function mediaSigningSecret(): string | null {
  const explicit = process.env.MEDIA_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  const jwt = process.env.JWT_SECRET?.trim();
  return jwt || null;
}

/** Extract uploads filename from API-relative or absolute static URL. */
export function normalizeMediaStoragePath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  const uploadsMatch = trimmed.match(/\/(?:api\/)?static\/uploads\/([^?#]+)/i);
  if (uploadsMatch?.[1]) return decodeURIComponent(uploadsMatch[1]);
  const seedMatch = trimmed.match(/\/(?:api\/)?static\/seed-audio\/([^?#]+)/i);
  if (seedMatch?.[1]) return `seed-audio/${decodeURIComponent(seedMatch[1])}`;
  return null;
}

function signPayload(storagePath: string, exp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${storagePath}:${exp}`).digest("base64url");
}

function safeEqualSig(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Issue a time-limited streaming URL for entitled premium media. */
export function createSignedMediaUrl(
  rawUrl: string | null | undefined,
  ttlSec = DEFAULT_TTL_SEC,
): string | null {
  if (!rawUrl?.trim()) return rawUrl ?? null;
  const storagePath = normalizeMediaStoragePath(rawUrl);
  if (!storagePath) return rawUrl;
  const secret = mediaSigningSecret();
  if (!secret) return rawUrl;

  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = signPayload(storagePath, exp, secret);
  const token = Buffer.from(JSON.stringify({ p: storagePath, exp, sig } satisfies SignedMediaPayload), "utf8").toString(
    "base64url",
  );
  return `/api/media/${token}`;
}

export function verifySignedMediaToken(tokenRaw: string): { storagePath: string; exp: number } | null {
  const secret = mediaSigningSecret();
  if (!secret || !tokenRaw?.trim()) return null;
  try {
    const json = Buffer.from(tokenRaw.trim(), "base64url").toString("utf8");
    const payload = JSON.parse(json) as SignedMediaPayload;
    if (
      typeof payload.p !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.sig !== "string" ||
      !payload.p.trim() ||
      Number.isNaN(payload.exp)
    ) {
      return null;
    }
    const storagePath = payload.p.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
    if (!storagePath || storagePath.includes("..")) return null;
    const expected = signPayload(storagePath, payload.exp, secret);
    if (!safeEqualSig(expected, payload.sig)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { storagePath, exp: payload.exp };
  } catch {
    return null;
  }
}

export function signPremiumMediaUrlIfEntitled(
  url: string | null | undefined,
  opts: { isPremium: boolean; entitled: boolean },
): string | null {
  if (!url?.trim()) return url ?? null;
  if (!opts.isPremium || !opts.entitled) return url;
  return createSignedMediaUrl(url) ?? url;
}
