import { FetchTimeoutError } from "./fetch-with-timeout";

/** Normalize a request URL to the `/api`-relative path used in logs. */
export function formatApiLogPath(url: string): string {
  try {
    const pathname = new URL(url, "http://local").pathname;
    if (pathname.startsWith("/api/")) return pathname.slice(4);
    if (pathname === "/api") return "/";
    if (pathname.startsWith("/api")) return pathname.slice(4) || "/";
    return pathname;
  } catch {
    if (url.startsWith("/api/")) return url.slice(4);
    if (url.startsWith("/api")) return url.slice(4) || "/";
    return url;
  }
}

export function logApiFetch(path: string, startedAt: number, err?: unknown): void {
  const endedAt = Date.now();
  const startIso = new Date(startedAt).toISOString();
  const endIso = new Date(endedAt).toISOString();
  const durationMs = endedAt - startedAt;

  if (err instanceof FetchTimeoutError) {
    console.warn(
      `[API Fetch] ${path} timed out after ${durationMs}ms (start=${startIso}, end=${endIso})`,
    );
    return;
  }

  if (err) {
    console.warn(
      `[API Fetch] ${path} failed after ${durationMs}ms (start=${startIso}, end=${endIso})`,
      err,
    );
    return;
  }

  console.info(`[API Fetch] ${path} took ${durationMs}ms (start=${startIso}, end=${endIso})`);
}
