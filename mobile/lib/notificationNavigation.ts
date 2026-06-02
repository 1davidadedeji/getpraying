import { router, type Href } from "expo-router";
import { InteractionManager } from "react-native";
import { apiUrl, authHeaders } from "@/lib/api";
import { bumpDeferredNavigation } from "@/lib/deferredNavigation";
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

/** Queue until EntitlementGate (or paywall enterApp) can navigate. */
export function queueNotificationHref(href: string): void {
  if (pendingNotificationHref === href) {
    bumpDeferredNavigation();
    return;
  }
  pendingNotificationHref = href;
  bumpDeferredNavigation();
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

/** Resolve push/in-app notification payload to a navigation target (no navigation). */
export function resolveNotificationTarget(
  data: Record<string, unknown>,
  opts?: { userRole?: string | null },
): NotificationNavigationTarget {
  const type = data.type != null ? String(data.type) : "";
  const postId = parseNotificationPostId(data.postId);
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
    return { kind: "href", href: "/(tabs)/" };
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

  if (Number.isFinite(postId)) {
    return { kind: "href", href: `/post/${postId}` };
  }

  return { kind: "href", href: "/(tabs)/notifications" };
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
    /** When set with deferUntilEntitled, apply immediately instead of queueing. */
    applyNowPathname?: string;
  },
): Promise<void> {
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

  const target = resolveNotificationTarget(data, { userRole: opts?.userRole });
  if (target.kind === "webAdmin") {
    openWebAdmin(target.path);
    return;
  }

  const defer = opts?.deferUntilEntitled ?? opts?.deferUntilTabsReady ?? false;
  const applyNowPathname = opts?.applyNowPathname;
  const canApplyNow =
    defer && typeof applyNowPathname === "string" && applyNowPathname.length > 0;

  if (canApplyNow) {
    applyDeferredNotificationHref(target.href, applyNowPathname);
    return;
  }

  if (defer) {
    queueNotificationHref(target.href);
    return;
  }

  router.push(target.href as Href);
}
