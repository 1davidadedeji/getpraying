import { router, type Href } from "expo-router";
import { apiFetch } from "@/lib/api";
import { bumpDeferredNavigation } from "@/lib/deferredNavigation";
import { requestPostDetailRefresh } from "@/lib/postDetailRefresh";
import {
  isStaffRole,
  openWebAdmin,
  webAdminPathForNotification,
} from "@/lib/webAdmin";

export type NotificationNavigationTarget =
  | { kind: "href"; href: string }
  | { kind: "webAdmin"; path: string };

/** Normalize `postId` from Expo push `data` (values are often strings). */
export function parseNotificationPostId(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return NaN;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

/** Read post id from push payload (Expo/APNs key shapes vary). */
export function postIdFromNotificationData(data: Record<string, unknown>): number {
  const direct = parseNotificationPostId(data.postId);
  if (Number.isFinite(direct)) return direct;
  return parseNotificationPostId(data.post_id);
}

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

function markNotificationReadIfNeeded(
  authToken: string | null | undefined,
  notificationId: number | undefined,
): void {
  if (!authToken || notificationId == null || !Number.isFinite(notificationId)) return;
  void apiFetch(`/notifications/${notificationId}/read`, {
    method: "POST",
    token: authToken,
  }).catch(() => {
    /* ignore */
  });
}

export function notificationOpensWebAdmin(type: string, userRole?: string | null): boolean {
  if (type === "mod_queue") return true;
  return type === "role_updated" && isStaffRole(userRole);
}

/** Deferred route consumed after EntitlementGate confirms access. */
let pendingNotificationHref: string | null = null;

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

function postIdFromPath(path: string): number | null {
  const match = normalizeNotificationPath(path).match(/^\/post\/(\d+)$/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function consumePendingNotificationHref(): string | null {
  const href = pendingNotificationHref;
  pendingNotificationHref = null;
  return href;
}

export function peekPendingNotificationHref(): string | null {
  return pendingNotificationHref;
}

/** Queue until EntitlementGate (or paywall enterApp) can navigate. */
export function queueNotificationHref(href: string): void {
  pendingNotificationHref = href;
  bumpDeferredNavigation();
}

/**
 * Navigate to a push/deep-link target.
 * - Already on the same screen: no-op.
 * - Detail routes (`/post/:id`, etc.): push onto the root stack (back returns to prior screen).
 * - Tab routes: push so Alerts/Library tabs remain reachable via back.
 */
export function applyNotificationHref(href: string, currentPathname: string): void {
  const targetPath = normalizeNotificationPath(href);
  const currentPath = normalizeNotificationPath(currentPathname);

  const targetPostId = postIdFromPath(targetPath);
  const currentPostId = postIdFromPath(currentPath);
  if (targetPostId != null && targetPostId === currentPostId) {
    pendingNotificationHref = null;
    requestPostDetailRefresh(targetPostId);
    return;
  }

  if (notificationPathsEqual(currentPath, targetPath)) {
    pendingNotificationHref = null;
    return;
  }

  pendingNotificationHref = null;

  const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  const fullHref = `${targetPath}${query}`;

  if (isStackDetailRoute(targetPath)) {
    if (isStackDetailRoute(currentPath)) {
      router.replace(fullHref as Href);
      return;
    }
    router.push(fullHref as Href);
    return;
  }

  router.push(fullHref as Href);
}

/** @deprecated Use applyNotificationHref */
export const applyDeferredNotificationHref = applyNotificationHref;

function libraryHrefForPrayerSlot(type: string): string {
  if (type === "evening_prayer") {
    return "/(tabs)/library?section=evening";
  }
  if (type === "morning_prayer") {
    return "/(tabs)/library?section=morning";
  }
  return "/(tabs)/library";
}

/** Resolve push/in-app notification payload to a navigation target (no navigation). */
export function resolveNotificationTarget(
  data: Record<string, unknown>,
  opts?: { userRole?: string | null },
): NotificationNavigationTarget {
  const type = data.type != null ? String(data.type) : "";
  const postId = postIdFromNotificationData(data);
  const actorUsername = data.actorUsername != null ? String(data.actorUsername) : "";
  const category = data.category != null ? String(data.category) : "";

  const webPath = webAdminPathForNotification(
    type,
    opts?.userRole,
    Number.isFinite(postId) ? postId : undefined,
  );
  if (webPath && (type === "mod_queue" || (type === "role_updated" && isStaffRole(opts?.userRole)))) {
    return { kind: "webAdmin", path: webPath };
  }

  if (type === "follow" && actorUsername) {
    return { kind: "href", href: `/user/${actorUsername}` };
  }

  if (type === "morning_prayer" || type === "evening_prayer" || type === "reminder") {
    return { kind: "href", href: libraryHrefForPrayerSlot(type) };
  }

  if (type === "daily_help_reminder") {
    return { kind: "href", href: "/(tabs)/library" };
  }

  if (type === "category_new") {
    return {
      kind: "href",
      href: category ? `/category/${encodeURIComponent(category)}` : "/(tabs)/library",
    };
  }

  if (type === "role_updated") {
    return { kind: "href", href: "/settings" };
  }

  // Prayer, comment, saved, milestone, post approved/declined, reported — all carry postId.
  if (Number.isFinite(postId)) {
    return { kind: "href", href: `/post/${postId}` };
  }

  return { kind: "href", href: "/(tabs)/notifications" };
}

/** Routes from in-app notification rows or from Expo push `data` (same shape). */
export function navigateFromNotificationData(
  data: Record<string, unknown>,
  opts?: {
    authToken?: string | null;
    skipMarkRead?: boolean;
    userRole?: string | null;
    /** @deprecated Use deferUntilEntitled */
    deferUntilTabsReady?: boolean;
    /** When true, queue href until root entitlement gate passes (no immediate navigation). */
    deferUntilEntitled?: boolean;
    /** Current pathname — when set with deferUntilEntitled, navigate immediately if entitled. */
    applyNowPathname?: string;
  },
): void {
  const notificationIdRaw = data.notificationId;
  const notificationId =
    notificationIdRaw !== undefined && notificationIdRaw !== null && notificationIdRaw !== ""
      ? Number(notificationIdRaw)
      : NaN;

  const target = resolveNotificationTarget(data, { userRole: opts?.userRole });
  if (target.kind === "webAdmin") {
    if (!opts?.skipMarkRead) {
      markNotificationReadIfNeeded(
        opts?.authToken,
        Number.isFinite(notificationId) ? notificationId : undefined,
      );
    }
    openWebAdmin(target.path);
    return;
  }

  const defer = opts?.deferUntilEntitled ?? opts?.deferUntilTabsReady ?? false;
  const applyNowPathname = opts?.applyNowPathname;
  const canApplyNow =
    defer && typeof applyNowPathname === "string" && applyNowPathname.length > 0;

  if (canApplyNow) {
    applyNotificationHref(target.href, applyNowPathname);
  } else if (defer) {
    queueNotificationHref(target.href);
  } else {
    applyNotificationHref(target.href, applyNowPathname ?? "");
  }

  if (!opts?.skipMarkRead) {
    markNotificationReadIfNeeded(
      opts?.authToken,
      Number.isFinite(notificationId) ? notificationId : undefined,
    );
  }
}
