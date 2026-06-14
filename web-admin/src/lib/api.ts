export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.getpraying.com";

export function apiUrl(path: string) {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api${p}`;
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}

/** CMS fetch — bypass browser HTTP cache so list views update immediately after saves. */
export function adminFetch(path: string, token: string | null, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    cache: "no-store",
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
}
