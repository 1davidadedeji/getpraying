import { router, type Href } from "expo-router";
import { apiUrl, authHeaders } from "@/lib/api";
import {
  isStaffRole,
  openWebAdmin,
  webAdminPathForNotification,
} from "@/lib/webAdmin";

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

export function notificationOpensWebAdmin(type: string, userRole?: string | null): boolean {
  if (type === "mod_queue") return true;
  return type === "role_updated" && isStaffRole(userRole);
}

/** Deferred route consumed after entitlement gate confirms access. */
let pendingNotificationHref: string | null = null;

export function consumePendingNotificationHref(): string | null {
  const href = pendingNotificationHref;
  pendingNotificationHref = null;
  return href;
}

export function peekPendingNotificationHref(): string | null {
  return pendingNotificationHref;
}

/** Queue only — EntitlementGate (or paywall enterApp) is the sole navigation consumer. */
function queueNotificationHref(href: string): void {
  pendingNotificationHref = href;
}

function libraryHrefForPrayerSlot(type: string): string {
  if (type === "evening_prayer") {
    return "/(tabs)/library?section=evening";
  }
  if (type === "morning_prayer") {
    return "/(tabs)/library?section=morning";
  }
  return "/(tabs)/library";
}

/** Routes from in-app notification rows or from Expo push `data` (same shape). */
export async function navigateFromNotificationData(
  data: Record<string, unknown>,
  opts?: {
    authToken?: string | null;
    skipMarkRead?: boolean;
    userRole?: string | null;
    /** @deprecated Use deferUntilEntitled */
    deferUntilTabsReady?: boolean;
    /** When true, queue href until root entitlement gate passes (no immediate navigation). */
    deferUntilEntitled?: boolean;
  },
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

  const webPath = webAdminPathForNotification(type, opts?.userRole, Number.isFinite(postId) ? postId : undefined);
  if (webPath && (type === "mod_queue" || (type === "role_updated" && isStaffRole(opts?.userRole)))) {
    openWebAdmin(webPath);
    return;
  }

  const defer = opts?.deferUntilEntitled ?? opts?.deferUntilTabsReady ?? false;

  const navigate = (href: string) => {
    if (defer) {
      queueNotificationHref(href);
      return;
    }
    router.push(href as Href);
  };

  if (type === "follow" && actorUsername) {
    navigate(`/user/${actorUsername}`);
    return;
  }

  if (type === "morning_prayer" || type === "evening_prayer" || type === "reminder") {
    navigate(libraryHrefForPrayerSlot(type));
    return;
  }

  if (type === "daily_help_reminder") {
    navigate("/(tabs)/");
    return;
  }

  if (type === "category_new") {
    navigate(
      category ? `/category/${encodeURIComponent(category)}` : "/(tabs)/library",
    );
    return;
  }

  if (type === "role_updated") {
    navigate("/settings");
    return;
  }

  if (Number.isFinite(postId)) {
    navigate(`/post/${postId}`);
    return;
  }

  navigate("/(tabs)/notifications");
}
