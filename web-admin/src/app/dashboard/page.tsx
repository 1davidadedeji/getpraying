"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV } from "@/config/dashboard-nav";
import { HubNavLink } from "@/components/dashboard/HubNavLink";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { panelCls } from "@/components/dashboard/form-styles";
import { useAuth } from "@/context/auth";
import { navForRole, primaryNavMatch } from "@/lib/dashboard-nav-utils";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";

interface Stats {
  totalUsers?: number;
  totalPosts?: number;
  pendingPosts?: number;
  approvedPosts?: number;
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
  const pending = (isAdmin ? stats.pendingPosts : modPending) ?? 0;

  useEffect(() => {
    if (!token || !isAdmin) return;
    adminFetch("/admin/stats", token)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d);
      })
      .catch(() => {});
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || isAdmin) return;
    adminFetch("/admin/pending-count", token)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === "number") setModPending(d.count);
      })
      .catch(() => {});
  }, [token, isAdmin]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Morning";
    if (h < 17) return "Afternoon";
    return "Evening";
  })();

  return (
    <>
      <PageHeader title={`${greeting}, ${user?.displayName ?? user?.username}`} />

      {isAdmin ? (
        <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            { label: "Users", value: stats.totalUsers },
            { label: "Prayers", value: stats.totalPosts },
            { label: "Pending", value: stats.pendingPosts, hot: (stats.pendingPosts ?? 0) > 0 },
            { label: "Today", value: stats.prayersToday },
          ].map((s) => (
            <div key={s.label} className={`${panelCls} px-2.5 py-2`}>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{s.label}</p>
              <p className={`text-base font-bold ${s.hot ? "text-[var(--color-flame)]" : "text-[var(--color-primary)]"}`}>
                {s.value === undefined ? "—" : s.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : pending > 0 ? (
        <Link href="/dashboard/moderation" className={`${panelCls} mb-3 block px-2.5 py-2 text-[12px] font-medium text-[var(--color-flame)]`}>
          {pending} pending — review now
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {navItems.map((item) => (
          <HubNavLink
            key={item.href}
            href={item.href}
            title={item.label}
            icon={item.icon}
            active={item.href === quickActiveHref}
            urgent={item.href === "/dashboard/moderation" && pending > 0}
          />
        ))}
      </div>
    </>
  );
}
