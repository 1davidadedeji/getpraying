"use client";

import { Search } from "lucide-react";
import { inputCls, panelCls } from "@/components/dashboard/form-styles";
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
    <div className={cn(panelCls, "mb-2 p-2.5")}>
      <div
        className={cn(
          "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:items-end",
          slotFilterVisible ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        <div className="lg:col-span-2">
          <label className="mb-0.5 block text-[10px] font-medium text-muted">Search</label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Keyword…"
              className={cn(inputCls, "bg-cream pl-9")}
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
      <p className="mt-2 text-[11px] text-muted">
        Showing <strong className="text-primary">{showingCount}</strong> of{" "}
        <strong className="text-primary">{totalCount}</strong>
      </p>
    </div>
  );
}
