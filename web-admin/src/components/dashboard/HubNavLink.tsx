"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function HubNavLink({
  href,
  title,
  subtitle,
  icon: Icon,
  active,
  urgent,
  collapsed = false,
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  active?: boolean;
  urgent?: boolean;
  collapsed?: boolean;
}) {
  const tooltip = collapsed ? [title, subtitle].filter(Boolean).join(" — ") : undefined;

  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      aria-current={active ? "page" : undefined}
      title={tooltip}
      className={cn(
        "group relative flex items-center border transition-[background-color,border-color,box-shadow,color] duration-150 ease-out",
        collapsed ? "justify-center rounded-xl p-2.5" : "gap-3 rounded-2xl p-3 sm:p-3.5",
        /* Active: border + inset hairline — stays inside rounded rect (no ring-offset clipping). */
        active &&
          "border-[var(--color-flame)] bg-[color-mix(in_srgb,var(--color-flame)_11%,var(--color-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-flame)_50%,transparent)]",
        !active &&
          "border-[color-mix(in_srgb,var(--color-border)_85%,transparent)] bg-[var(--color-surface)] hover:border-[color-mix(in_srgb,var(--color-flame)_35%,var(--color-border))] hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,var(--color-surface))]",
        urgent &&
          !active &&
          "border-[color-mix(in_srgb,var(--color-flame)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-flame)_7%,var(--color-surface))]",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150",
          collapsed ? "h-10 w-10" : "h-10 w-10 sm:h-11 sm:w-11",
          urgent && "bg-[var(--color-flame)] text-white",
          !urgent && active && "bg-[color-mix(in_srgb,var(--color-flame)_18%,var(--color-cream))] text-[var(--color-primary)]",
          !urgent &&
            !active &&
            "bg-[var(--color-cream)] text-[var(--color-primary)] group-hover:bg-[color-mix(in_srgb,var(--color-flame)_88%,var(--color-cream))] group-hover:text-white",
        )}
      >
        <Icon className={cn(collapsed ? "h-[20px] w-[20px]" : "h-[21px] w-[21px] sm:h-[22px] sm:w-[22px]")} strokeWidth={1.75} />
      </div>

      {!collapsed ? (
        <>
          <div className="min-w-0 flex-1 pl-0.5">
            <p className="text-[14px] font-semibold leading-snug text-[var(--color-primary)] sm:text-[15px]">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--color-muted)] sm:text-[13px]">{subtitle}</p>
            ) : null}
          </div>
          <ChevronRight
            className={cn(
              "h-[17px] w-[17px] shrink-0 text-[var(--color-muted)] transition-transform duration-150 group-hover:translate-x-0.5 sm:h-[18px] sm:w-[18px]",
              active && "text-[color-mix(in_srgb,var(--color-flame)_75%,var(--color-muted))]",
            )}
            aria-hidden
          />
        </>
      ) : null}
    </Link>
  );
}
