import { apiFetch } from "@/lib/api";
import { notificationRowToPushData } from "@/lib/notificationNavigation";
import { normalizeNotificationPayload } from "@/lib/notificationPayloadNormalize";

export { normalizeNotificationPayload } from "@/lib/notificationPayloadNormalize";

type NotificationNavRow = {
  id: number;
  type: string;
  postId?: number | null;
  actorUsername?: string | null;
  category?: string | null;
};

/**
 * When push `data` is missing `postId`, load the notification row from the API (same shape as in-app list).
 */
export async function enrichNotificationPayload(
  data: Record<string, unknown>,
  authToken: string | null | undefined,
): Promise<Record<string, unknown>> {
  if (!authToken) return data;

  const postId = data.postId ?? data.post_id;
  if (postId !== undefined && postId !== null && postId !== "") return data;

  const idRaw = data.notificationId ?? data.notification_id;
  const notificationId =
    idRaw !== undefined && idRaw !== null && idRaw !== "" ? Number(idRaw) : NaN;
  if (!Number.isFinite(notificationId) || notificationId <= 0) return data;

  try {
    const res = await apiFetch(`/notifications/${notificationId}`, { token: authToken });
    if (!res.ok) return data;
    const row = (await res.json()) as NotificationNavRow;
    return {
      ...data,
      ...notificationRowToPushData({
        id: row.id,
        type: row.type,
        postId: row.postId,
        actorUsername: row.actorUsername,
        category: row.category,
      }),
    };
  } catch {
    return data;
  }
}
