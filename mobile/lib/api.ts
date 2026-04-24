import { getApiBaseUrl } from "@/lib/apiBase";

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
