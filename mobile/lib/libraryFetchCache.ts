import { apiFetch } from "@/lib/api";

type CacheEntry = { at: number; data: unknown };

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Client-side cache for library reads (stale-while-revalidate). */
export const LIBRARY_FETCH_CACHE_MS = 120_000;

/** Premium vs free responses differ — bust cache when entitlement changes. */
let entitlementKey = "f";

/** Update entitlement tier; clears in-memory library cache when the tier changes. */
export function setLibraryFetchEntitlement(subscribed: boolean): void {
  const next = subscribed ? "p" : "f";
  if (next === entitlementKey) return;
  entitlementKey = next;
  store.clear();
  inflight.clear();
}

function cacheKey(path: string, token: string | null | undefined): string {
  return `${path}|${token ?? ""}|${entitlementKey}`;
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
 * In-flight identical requests share one network call.
 */
export async function fetchLibraryCached<T>(
  path: string,
  token: string | null | undefined,
  opts?: { force?: boolean; timeoutMs?: number },
): Promise<T | null> {
  const key = cacheKey(path, token);
  const stale = store.get(key)?.data as T | undefined;

  if (!opts?.force) {
    const fresh = peekLibraryCache<T>(path, token);
    if (fresh != null) return fresh;

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T | null>;
  }

  const fetchPromise = (async (): Promise<T | null> => {
    try {
      const res = await apiFetch(path, { token, timeoutMs: opts?.timeoutMs });
      if (!res.ok) return stale ?? null;
      const data = (await res.json()) as T;
      setLibraryCache(path, token, data);
      return data;
    } catch {
      return stale ?? null;
    }
  })();

  if (!opts?.force) inflight.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inflight.delete(key);
  }
}
