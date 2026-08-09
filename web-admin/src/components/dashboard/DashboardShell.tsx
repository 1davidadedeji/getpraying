"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { DASHBOARD_NAV } from "@/config/dashboard-nav";
import { HubNavLink } from "@/components/dashboard/HubNavLink";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/cn";
import { labelForPath, navForRole, primaryNavMatch } from "@/lib/dashboard-nav-utils";

const SIDEBAR_COLLAPSED_KEY = "gp-web-admin-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPrefsLoaded, setSidebarPrefsLoaded] = useState(false);

  const visibleNav = useMemo(
    () => navForRole(user?.role ?? "moderator", DASHBOARD_NAV),
    [user?.role],
  );

  const activeHref = useMemo(
    () => primaryNavMatch(pathname, visibleNav)?.href ?? null,
    [pathname, visibleNav],
  );

  const activeTitle = labelForPath(pathname, visibleNav);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
    setSidebarPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!sidebarPrefsLoaded) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, sidebarPrefsLoaded]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const NavBlock = ({
    className,
    collapsed,
    mobile = false,
  }: {
    className?: string;
    collapsed?: boolean;
    mobile?: boolean;
  }) => (
    <nav className={cn("flex flex-col gap-0.5", className)} aria-label="Admin sections">
      {visibleNav.map((item) => (
        <HubNavLink
          key={item.href}
          href={item.href}
          title={item.label}
          icon={item.icon}
          active={item.href === activeHref}
          collapsed={!!collapsed && !mobile}
        />
      ))}
    </nav>
  );

  const ProfileAvatar = ({ compact }: { compact?: boolean }) => {
    const initial = (user?.displayName ?? user?.username ?? "?").trim().slice(0, 1).toUpperCase() || "?";
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-border bg-surface font-semibold text-primary shadow-sm",
          compact ? "h-9 w-9 text-[12px]" : "h-10 w-10 text-[13px]",
        )}
        aria-hidden
      >
        {initial}
      </div>
    );
  };

  const UserBlock = ({ collapsed }: { collapsed?: boolean }) => (
    <div className="mt-auto border-t border-border pt-3">
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-0 pb-1">
          <ProfileAvatar compact />
          <button
            type="button"
            onClick={logout}
            title={`Sign out (${user?.username ?? ""})`}
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-primary"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1 py-2">
            <ProfileAvatar />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-primary">
                {user?.displayName ?? user?.username}
              </p>
              <p className="text-[11px] capitalize text-muted">{user?.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted transition-colors hover:bg-surface hover:text-primary"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Sign out
          </button>
        </>
      )}
    </div>
  );

  const AsideCollapseToggle = ({ collapsed: railCollapsed }: { collapsed: boolean }) => (
    <button
      type="button"
      onClick={() => setSidebarCollapsed((c) => !c)}
      title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!railCollapsed}
      aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
    >
      {railCollapsed ? (
        <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
      ) : (
        <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
      )}
    </button>
  );

  return (
    <div className="flex min-h-[100dvh] bg-cream-muted">
      {/* Desktop / tablet rail */}
      <aside
        className={cn(
          "relative z-30 hidden h-[100dvh] shrink-0 flex-col overflow-hidden border-r border-border bg-cream shadow-[1px_0_0_color-mix(in_srgb,var(--color-primary)_4%,transparent)] transition-[width] duration-200 ease-out md:fixed md:inset-y-0 md:left-0 md:flex",
          sidebarCollapsed ? "md:w-14" : "md:w-56",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
            sidebarCollapsed ? "px-2 py-3" : "px-2.5 py-3",
          )}
        >
          {sidebarCollapsed ? (
            <div className="mb-4 flex flex-col items-center gap-2">
              <Link
                href="/dashboard"
                aria-label="Get Praying admin home"
                className="flex rounded-xl p-1 outline-none ring-flame transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" aria-hidden />
              </Link>
              <AsideCollapseToggle collapsed={sidebarCollapsed} />
            </div>
          ) : (
            <div className="mb-2 flex min-w-0 items-center justify-between gap-1">
              <Link
                href="/dashboard"
                aria-label="Get Praying admin home"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-0.5 py-0.5 outline-none hover:opacity-90"
              >
                <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" aria-hidden />
                <span className="font-heading truncate text-[13px] font-bold leading-none whitespace-nowrap text-primary">
                  Get Praying
                </span>
              </Link>
              <AsideCollapseToggle collapsed={sidebarCollapsed} />
            </div>
          )}

          <NavBlock className="min-h-0 flex-1 pb-3" collapsed={sidebarCollapsed} />

          <UserBlock collapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-opacity md:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100%,19rem)] flex-col overflow-hidden border-r border-border bg-cream shadow-xl transition-transform duration-200 ease-out md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setDrawerOpen(false)}>
              <Image src="/logo.png" alt="Get Praying" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-heading truncate text-sm font-bold text-primary">Get Praying</span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-muted hover:bg-surface"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
          <NavBlock className="flex-1" mobile />
          <UserBlock />
        </div>
      </aside>

      <div
        className={cn(
          "flex min-h-[100dvh] flex-1 flex-col transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "md:pl-14" : "md:pl-56",
        )}
      >
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-[color-mix(in_srgb,var(--color-cream)_94%,white)] px-3 py-2.5 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl p-2.5 text-primary transition-colors hover:bg-surface"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-heading truncate text-base font-bold text-primary">{activeTitle}</p>
            <p className="truncate text-[10px] text-muted">
              {user?.role === "admin" ? "Administrator" : "Moderator"} · {user?.username}
            </p>
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col">
          <div className="mx-auto min-h-[100dvh] w-full max-w-[1800px] border-x border-transparent">
            <div className="min-h-[100dvh] bg-cream-muted pb-6">
              <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-4">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
