import { apiFetch, type ApiFetchOptions } from "@/lib/api";

const inflight = new Map<string, Promise<Response>>();

function inflightKey(path: string, token?: string | null): string {
  return `${path}|${token ?? ""}`;
}

/** Coalesce identical GET requests until the first in-flight call completes. */
export function apiFetchGetOnce(path: string, opts?: ApiFetchOptions): Promise<Response> {
  const key = inflightKey(path, opts?.token);
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = apiFetch(path, opts).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Test-only: clear in-flight GET coalescing state. */
export function clearInFlightGet(): void {
  inflight.clear();
}
