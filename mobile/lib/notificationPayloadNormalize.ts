/**
 * Flatten Expo/APNs payload shapes (nested `body`, stringified JSON, snake_case keys).
 */
export function normalizeNotificationPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};

  const data = { ...(raw as Record<string, unknown>) };

  const bodyField = data.body;
  if (typeof bodyField === "string" && bodyField.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(bodyField) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        Object.assign(data, parsed);
      }
    } catch {
      /* ignore */
    }
  } else if (bodyField && typeof bodyField === "object" && !Array.isArray(bodyField)) {
    Object.assign(data, bodyField as Record<string, unknown>);
  }

  if (data.postId == null && data.post_id != null) {
    data.postId = data.post_id;
  }
  if (data.notificationId == null && data.notification_id != null) {
    data.notificationId = data.notification_id;
  }
  if (data.actorUsername == null && data.actor_username != null) {
    data.actorUsername = data.actor_username;
  }

  return data;
}
