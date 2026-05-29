import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ClipboardList,
  FolderTree,
  Inbox,
  LayoutDashboard,
  PlayCircle,
  ScrollText,
  Users,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: LucideIcon;
  /** Hidden for moderators — aligns with mobile admin hub */
  adminOnly?: boolean;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true, icon: LayoutDashboard },
  { href: "/dashboard/moderation", label: "Moderation", icon: Inbox },
  { href: "/dashboard/posts", label: "All posts", icon: ClipboardList, adminOnly: true },
  { href: "/dashboard/official-prayers", label: "Official guides", icon: BookOpen, adminOnly: true },
  { href: "/dashboard/paths", label: "Category guides", icon: FolderTree, adminOnly: true },
  { href: "/dashboard/lectures", label: "Lectures", icon: PlayCircle, adminOnly: true },
  { href: "/dashboard/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/dashboard/daily-word", label: "Daily Word", icon: ScrollText, adminOnly: true },
  { href: "/dashboard/notifications", label: "Push", icon: Bell, adminOnly: true },
];
