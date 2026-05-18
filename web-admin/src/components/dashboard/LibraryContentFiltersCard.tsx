"use client";

import { Search } from "lucide-react";
import { inputCls } from "@/components/dashboard/form-styles";
import { cn } from "@/lib/cn";
import { AdminSelect } from "@/components/ui/AdminSelect";

type SlotOpt = "all" | "morning" | "evening" | "none";

export function LibraryContentFiltersCard({
  search,
  onSearchChange,
  slotFilter,
  onSlotFilterChange,
  audioFilter,
  onAudioFilterChange,
  showingCount,
  totalCount,
  slotFilterVisible,
  hideNoSlotFilterOption = false,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  slotFilter: SlotOpt;
  onSlotFilterChange: (v: SlotOpt) => void;
  audioFilter: "all" | "yes" | "no";
  onAudioFilterChange: (v: "all" | "yes" | "no") => void;
  showingCount: number;
  totalCount: number;
  slotFilterVisible?: boolean;
  /** When true, sanctuary slot filter only offers all / morning / evening (no “no slot”). */
  hideNoSlotFilterOption?: boolean;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-[color-mix(in_srgb,var(--color-border)_90%,transparent)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">Find & narrow</p>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:items-end",
          slotFilterVisible ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        <div className="lg:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-muted)]">Search titles & text</label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Keyword…"
              className={cn(inputCls, "bg-[var(--color-cream)] pl-9")}
            />
          </div>
        </div>
        {slotFilterVisible ? (
          <AdminSelect label="Sanctuary slot" value={slotFilter} onChange={(v) => onSlotFilterChange(v as SlotOpt)}>
            <option value="all">All slots</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            {!hideNoSlotFilterOption ? <option value="none">No slot</option> : null}
          </AdminSelect>
        ) : (
          <div className="hidden lg:block" aria-hidden />
        )}
        <AdminSelect label="Audio" value={audioFilter} onChange={(v) => onAudioFilterChange(v as "all" | "yes" | "no")}>
          <option value="all">All entries</option>
          <option value="yes">Has audio</option>
          <option value="no">No audio</option>
        </AdminSelect>
      </div>
      <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[12px] text-[var(--color-muted)]">
        Showing <strong className="text-[var(--color-primary)]">{showingCount}</strong> of{" "}
        <strong className="text-[var(--color-primary)]">{totalCount}</strong> loaded items
        {showingCount === 0 && totalCount > 0 ? " — adjust filters" : null}
      </p>
    </div>
  );
}
