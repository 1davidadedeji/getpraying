export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.getpraying.com";

export function apiUrl(path: string) {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api${p}`;
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}
