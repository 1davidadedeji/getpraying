"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const triggerBase =
  "w-full cursor-pointer rounded-lg border border-border bg-surface text-primary shadow-[inset_0_1px_0_color-mix(in_srgb,white_70%,transparent)] transition-[border-color,background-color] hover:border-flame/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-flame disabled:cursor-not-allowed disabled:opacity-45 appearance-none";

export function AdminSelect({
  label,
  value,
  onChange,
  children,
  className,
  disabled,
  id,
  size = "default",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  size?: "default" | "compact";
}) {
  const selectId = id ?? `adm-select-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={selectId} className="mb-1 block text-[11px] font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            triggerBase,
            size === "compact" ? "py-1.5 pl-2.5 pr-8 text-[12px]" : "py-2 pl-3 pr-10 text-[13px]",
          )}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute text-muted",
            size === "compact" ? "right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" : "right-3 top-1/2 h-4 w-4 -translate-y-1/2",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </div>
  );
}
