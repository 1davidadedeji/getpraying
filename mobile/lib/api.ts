import { getApiBaseUrl } from "@/lib/apiBase";
import {
  DEFAULT_API_TIMEOUT_MS,
  fetchWithTimeout,
  logApiFetch,
} from "@workspace/api-client-react";

export function authHeaders(
  token: string | null | undefined,
  extra?: Record<string, string>,
): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}/api${path}`;
}

export type ApiFetchOptions = {
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
};

/** GET/POST against `/api` with auth headers and a bounded timeout. */
export async function apiFetch(path: string, opts?: ApiFetchOptions): Promise<Response> {
  const startedAt = Date.now();

  try {
    const res = await fetchWithTimeout(apiUrl(path), {
      method: opts?.method ?? "GET",
      headers: authHeaders(opts?.token, opts?.headers),
      body: opts?.body,
      signal: opts?.signal,
      timeoutMs: opts?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
    });
    logApiFetch(path, startedAt);
    return res;
  } catch (err) {
    logApiFetch(path, startedAt, err);
    throw err;
  }
}
