import { router, type Href } from "expo-router";
import { apiUrl, authHeaders } from "@/lib/api";

export function notificationRowToPushData(item: {
  id: number;
  type: string;
  postId?: number | null;
  actorUsername?: string | null;
  category?: string | null;
}): Record<string, unknown> {
  return {
    notificationId: item.id,
    type: item.type,
    ...(item.postId != null ? { postId: item.postId } : {}),
    ...(item.actorUsername ? { actorUsername: item.actorUsername } : {}),
    ...(item.category ? { category: item.category } : {}),
  };
}

async function markNotificationReadIfNeeded(
  authToken: string | null | undefined,
  notificationId: number | undefined,
): Promise<void> {
  if (!authToken || notificationId == null || !Number.isFinite(notificationId)) return;
  try {
    await fetch(apiUrl(`/notifications/${notificationId}/read`), {
      method: "POST",
      headers: authHeaders(authToken),
    });
  } catch {
    /* ignore */
  }
}

/** Routes from in-app notification rows or from Expo push `data` (same shape). */
export async function navigateFromNotificationData(
  data: Record<string, unknown>,
  opts?: { authToken?: string | null; skipMarkRead?: boolean },
): Promise<void> {
  const type = data.type != null ? String(data.type) : "";
  const postIdRaw = data.postId;
  const postId =
    postIdRaw !== undefined && postIdRaw !== null && postIdRaw !== ""
      ? Number(postIdRaw)
      : NaN;
  const actorUsername = data.actorUsername != null ? String(data.actorUsername) : "";
  const category = data.category != null ? String(data.category) : "";
  const notificationIdRaw = data.notificationId;
  const notificationId =
    notificationIdRaw !== undefined && notificationIdRaw !== null && notificationIdRaw !== ""
      ? Number(notificationIdRaw)
      : NaN;

  if (!opts?.skipMarkRead) {
    await markNotificationReadIfNeeded(
      opts?.authToken,
      Number.isFinite(notificationId) ? notificationId : undefined,
    );
  }

  if (type === "follow" && actorUsername) {
    router.push(`/user/${actorUsername}` as Href);
    return;
  }
  if (type === "mod_queue") {
    router.push("/admin/queue" as Href);
    return;
  }
  if (type === "role_updated") {
    router.push("/settings" as Href);
    return;
  }
  if (type === "category_new") {
    router.push(
      (category ? `/category/${encodeURIComponent(category)}` : "/library") as Href,
    );
    return;
  }
  if (Number.isFinite(postId)) {
    router.push(`/post/${postId}` as Href);
    return;
  }

  router.push("/(tabs)/notifications" as Href);
}
