import { router, type Href } from "expo-router";
import { InteractionManager } from "react-native";
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

/** Deferred route consumed after EntitlementGate confirms access. */
let pendingNotificationHref: string | null = null;
/** Prevents applying the same deferred href twice in one session (double stack entries). */
let lastAppliedNotificationHref: string | null = null;

function normalizeNotificationPath(path: string): string {
  const base = path.split("?")[0].replace(/\/+$/, "") || "/";
  return base.startsWith("/") ? base : `/${base}`;
}

function notificationPathsEqual(a: string, b: string): boolean {
  return normalizeNotificationPath(a) === normalizeNotificationPath(b);
}

function isStackDetailRoute(path: string): boolean {
  return /^\/(post|user|official|path|category)\//.test(normalizeNotificationPath(path));
}

function isOnTabsRoute(pathname: string): boolean {
  const p = pathname || "";
  return p.includes("(tabs)") || p === "/index" || p.endsWith("/index");
}

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
  if (pendingNotificationHref === href) return;
  pendingNotificationHref = href;
}

/**
 * Navigate to a deferred push/deep-link target without duplicating stack entries.
 * Detail routes push onto tabs so back returns to the feed once.
 */
export function applyDeferredNotificationHref(href: string, currentPathname: string): void {
  const targetPath = normalizeNotificationPath(href);
  const currentPath = normalizeNotificationPath(currentPathname);

  if (notificationPathsEqual(currentPath, targetPath)) {
    lastAppliedNotificationHref = href;
    pendingNotificationHref = null;
    return;
  }

  if (lastAppliedNotificationHref === href) {
    pendingNotificationHref = null;
    return;
  }

  lastAppliedNotificationHref = href;
  pendingNotificationHref = null;

  const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  const fullHref = `${targetPath}${query}`;

  if (isStackDetailRoute(targetPath)) {
    if (isOnTabsRoute(currentPathname)) {
      router.push(fullHref as Href);
      return;
    }
    router.replace("/(tabs)" as Href);
    InteractionManager.runAfterInteractions(() => {
      router.push(fullHref as Href);
    });
    return;
  }

  router.replace(fullHref as Href);
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
