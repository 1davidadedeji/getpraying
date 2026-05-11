"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV } from "@/config/dashboard-nav";
import { HubNavLink } from "@/components/dashboard/HubNavLink";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { useAuth } from "@/context/auth";
import { navForRole, primaryNavMatch } from "@/lib/dashboard-nav-utils";
import { apiUrl, authHeaders } from "@/lib/api";

interface Stats {
  totalUsers?: number;
  activeUsers?: number;
  totalPosts?: number;
  pendingPosts?: number;
  approvedPosts?: number;
  declinedPosts?: number;
  bannedUsers?: number;
  prayersToday?: number;
}

export default function DashboardPage() {
  const pathname = usePathname();
  const { user, token } = useAuth();
  const [stats, setStats] = useState<Stats>({});
  const [modPending, setModPending] = useState(0);
  const navItems = navForRole(user?.role ?? "moderator", DASHBOARD_NAV).filter((i) => i.href !== "/dashboard");
  const quickActiveHref = primaryNavMatch(pathname, navItems)?.href ?? null;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!token || !isAdmin) return;
    fetch(apiUrl("/admin/stats"), { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d);
      })
      .catch(() => {});
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || isAdmin) return;
    fetch(apiUrl("/admin/pending-count"), { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === "number") setModPending(d.count);
      })
      .catch(() => {});
  }, [token, isAdmin]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.displayName ?? user?.username}`}
        description={`${user?.role ?? ""} · Get Praying`}
      />

      {isAdmin ? (
        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.totalUsers} sub={`${stats.bannedUsers ?? 0} banned`} />
          <StatCard label="Total prayers" value={stats.totalPosts} sub={`${stats.approvedPosts ?? 0} live`} />
          <StatCard
            label="Pending review"
            value={stats.pendingPosts}
            accent={(stats.pendingPosts ?? 0) > 0}
          />
          <StatCard label="Prayers today" value={stats.prayersToday} />
        </div>
      ) : null}

      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] sm:text-[13px]">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {navItems.map((item) => (
          <HubNavLink
            key={item.href}
            href={item.href}
            title={item.label}
            subtitle={item.subtitle}
            icon={item.icon}
            active={item.href === quickActiveHref}
            urgent={
              item.href === "/dashboard/moderation" &&
              ((isAdmin ? stats.pendingPosts : modPending) ?? 0) > 0
            }
          />
        ))}
      </div>
    </>
  );
}
