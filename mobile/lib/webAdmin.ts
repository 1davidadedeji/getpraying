import * as Linking from "react-native";

const DEFAULT_WEB_ADMIN_ORIGIN = "https://admin.getpraying.com";

/** Base URL for the Next.js web-admin CMS (moderation, users, broadcasts). */
export function getWebAdminOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_ADMIN_ORIGIN?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_WEB_ADMIN_ORIGIN).replace(/\/$/, "");
}

export function webAdminUrl(path: string): string {
  const base = getWebAdminOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function openWebAdmin(path: string): void {
  void Linking.openURL(webAdminUrl(path));
}

/** Deep link path inside web-admin for a push/in-app notification type. */
export function webAdminPathForNotification(
  type: string,
  userRole?: string | null,
  postId?: number,
): string | null {
  switch (type) {
    case "mod_queue":
      return Number.isFinite(postId) ? `/dashboard/moderation?postId=${postId}` : "/dashboard/moderation";
    case "role_updated":
      return userRole === "admin" ? "/dashboard/users" : "/dashboard";
    default:
      return null;
  }
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "moderator";
}
