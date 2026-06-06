import { apiFetch } from "@/lib/api";

/** Keeps `users.timezone` aligned for server-scheduled morning/evening pushes (works without push permission). */
export async function syncDeviceTimezone(apiJwt: string | null): Promise<void> {
  if (!apiJwt) return;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timezone) return;
  await apiFetch("/users/me", {
    method: "PATCH",
    token: apiJwt,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timezone }),
  }).catch(() => {});
}
