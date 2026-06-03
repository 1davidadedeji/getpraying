/** Short-lived in-memory cache for read-mostly library endpoints. */
const entries = new Map<string, { expiresAt: number; body: unknown }>();

const DEFAULT_TTL_MS = 90_000;

export function getLibraryReadCache(key: string): unknown | null {
  const row = entries.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    entries.delete(key);
    return null;
  }
  return row.body;
}

export function setLibraryReadCache(key: string, body: unknown, ttlMs = DEFAULT_TTL_MS): void {
  entries.set(key, { body, expiresAt: Date.now() + ttlMs });
}

export function sendCachedJson(res: import("express").Response, body: unknown): void {
  res.setHeader("Cache-Control", "private, max-age=60");
  res.json(body);
}
