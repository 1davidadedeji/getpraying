"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";

const btnCls =
  "inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:border-flame disabled:opacity-35 sm:px-2.5";

export function AdminPaginationBar({
  page,
  totalPages,
  totalMatching,
  pageSize,
  loading,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  totalMatching: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const tp = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), tp);
  const start = totalMatching === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalMatching);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-[12px] text-muted">
        <span className="font-semibold text-primary">
          {start}-{end}
        </span>{" "}
        of <span className="font-semibold text-primary">{totalMatching}</span>
        {" · "}
        Page{" "}
        <span className="font-semibold text-primary">{safePage}</span> / {tp}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnCls}
          disabled={loading || safePage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="hidden sm:inline">First</span>
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={loading || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={loading || safePage >= tp}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={loading || safePage >= tp}
          onClick={() => onPageChange(tp)}
          aria-label="Last page"
        >
          <span className="hidden sm:inline">Last</span>
          <ChevronsRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
