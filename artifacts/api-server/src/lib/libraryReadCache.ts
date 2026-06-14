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

export function clearLibraryReadCache(): void {
  entries.clear();
}

export function isStaffLibraryUser(user: unknown): boolean {
  if (user == null || typeof user !== "object") return false;
  const role = (user as { role?: string }).role;
  return role === "admin" || role === "moderator";
}

export function sendCachedJson(res: import("express").Response, body: unknown): void {
  res.setHeader("Cache-Control", "private, max-age=60");
  res.json(body);
}

/** Fresh library payload for CMS staff — skip HTTP caching in browsers. */
export function sendFreshJson(res: import("express").Response, body: unknown): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.json(body);
}
