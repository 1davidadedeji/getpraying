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
  subtitle: string;
  exact?: boolean;
  icon: LucideIcon;
  /** Hidden for moderators — aligns with mobile admin hub */
  adminOnly?: boolean;
};

/** Mirrors mobile `app/admin/index.tsx` hub sections + web extras (overview, all posts, push). */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    subtitle: "Stats and shortcuts",
    exact: true,
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/moderation",
    label: "Moderation queue",
    subtitle: "Approve or decline pending prayers",
    icon: Inbox,
  },
  {
    href: "/dashboard/posts",
    label: "All posts",
    subtitle: "Browse and remove approved prayers",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    href: "/dashboard/official-prayers",
    label: "Official guides",
    subtitle: "Morning and evening sanctuary audio",
    icon: BookOpen,
    adminOnly: true,
  },
  {
    href: "/dashboard/paths",
    label: "Category guides",
    subtitle: "Library paths — anxiety, family, forgiveness, and more",
    icon: FolderTree,
    adminOnly: true,
  },
  {
    href: "/dashboard/lectures",
    label: "Lectures",
    subtitle: "Official lecture carousel",
    icon: PlayCircle,
    adminOnly: true,
  },
  {
    href: "/dashboard/users",
    label: "Users & roles",
    subtitle: "Roles, ban, delete",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/dashboard/daily-word",
    label: "Daily Word",
    subtitle: "Welcome screen verse (manual or auto)",
    icon: ScrollText,
    adminOnly: true,
  },
  {
    href: "/dashboard/notifications",
    label: "Push notifications",
    subtitle: "Broadcast to members",
    icon: Bell,
    adminOnly: true,
  },
];
