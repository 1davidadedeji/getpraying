"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function HubNavLink({
  href,
  title,
  icon: Icon,
  active,
  urgent,
  collapsed = false,
}: {
  href: string;
  title: string;
  icon: LucideIcon;
  active?: boolean;
  urgent?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      aria-current={active ? "page" : undefined}
      title={collapsed ? title : undefined}
      className={cn(
        "group flex items-center transition-colors duration-150",
        collapsed ? "justify-center rounded-lg p-2" : "gap-2.5 rounded-lg px-2.5 py-2",
        active
          ? "bg-[color-mix(in_srgb,var(--color-flame)_12%,var(--color-surface))] text-primary"
          : "text-text-secondary hover:bg-surface hover:text-primary",
        urgent && !active && "bg-[color-mix(in_srgb,var(--color-flame)_8%,var(--color-surface))]",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md transition-colors",
          collapsed ? "h-8 w-8" : "h-7 w-7",
          urgent && "bg-flame text-white",
          !urgent && active && "bg-[color-mix(in_srgb,var(--color-flame)_20%,var(--color-cream))] text-primary",
          !urgent && !active && "bg-cream text-primary group-hover:bg-[color-mix(in_srgb,var(--color-flame)_85%,var(--color-cream))] group-hover:text-white",
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </div>
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-none">{title}</span>
      ) : null}
      {urgent && !collapsed ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-flame" aria-hidden />
      ) : null}
    </Link>
  );
}
