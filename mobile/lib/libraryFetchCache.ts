import { apiUrl, authHeaders } from "@/lib/api";

type CacheEntry = { at: number; data: unknown };

const store = new Map<string, CacheEntry>();

/** Client-side cache for library reads (stale-while-revalidate). */
export const LIBRARY_FETCH_CACHE_MS = 120_000;

function cacheKey(path: string, token: string | null | undefined): string {
  return `${path}|${token ?? ""}`;
}

export function peekLibraryCache<T>(path: string, token: string | null | undefined): T | null {
  const hit = store.get(cacheKey(path, token));
  if (!hit) return null;
  if (Date.now() - hit.at > LIBRARY_FETCH_CACHE_MS) return null;
  return hit.data as T;
}

export function setLibraryCache(path: string, token: string | null | undefined, data: unknown): void {
  store.set(cacheKey(path, token), { at: Date.now(), data });
}

export function clearLibraryCache(): void {
  store.clear();
}

/**
 * GET JSON with in-memory cache. Returns stale data on network failure when available.
 */
export async function fetchLibraryCached<T>(
  path: string,
  token: string | null | undefined,
  opts?: { force?: boolean },
): Promise<T | null> {
  const key = cacheKey(path, token);
  const stale = store.get(key)?.data as T | undefined;
  if (!opts?.force) {
    const fresh = peekLibraryCache<T>(path, token);
    if (fresh != null) return fresh;
  }

  try {
    const res = await fetch(apiUrl(path), { headers: authHeaders(token) });
    if (!res.ok) return stale ?? null;
    const data = (await res.json()) as T;
    setLibraryCache(path, token, data);
    return data;
  } catch {
    return stale ?? null;
  }
}
