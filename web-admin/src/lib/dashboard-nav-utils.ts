import type { DashboardNavItem } from "@/config/dashboard-nav";

export function navForRole(role: "admin" | "moderator" | string, items: DashboardNavItem[]): DashboardNavItem[] {
  if (role === "admin") return items;
  return items.filter((i) => !i.adminOnly);
}

export function isNavActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** All sections that match the current path (can overlap if routes nest oddly). */
export function navMatchesForPath(pathname: string, items: DashboardNavItem[]): DashboardNavItem[] {
  return items.filter((i) => isNavActive(pathname, i));
}

/**
 * Pick the single nav entry that best represents this URL — longest matching `href`
 * wins so `/dashboard/posts` beats `/dashboard` when both would match.
 */
export function primaryNavMatch(pathname: string, items: DashboardNavItem[]): DashboardNavItem | null {
  const matches = navMatchesForPath(pathname, items);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.href.length - a.href.length)[0];
}

export function labelForPath(pathname: string, items: DashboardNavItem[]): string {
  return primaryNavMatch(pathname, items)?.label ?? "Admin";
}
