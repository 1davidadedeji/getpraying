"use client";

import { Search } from "lucide-react";
import { inputCls } from "@/components/dashboard/form-styles";
import { cn } from "@/lib/cn";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { POST_CATEGORY_FILTER_OPTIONS } from "@/config/post-categories";

export function AdminPostFiltersCard({
  title = "Filters",
  search,
  onSearchChange,
  category,
  onCategoryChange,
  media,
  onMediaChange,
  status,
  onStatusChange,
  showStatus,
  pageSize,
  onPageSizeChange,
  totalMatching,
  loading,
}: {
  title?: string;
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  media: string;
  onMediaChange: (v: string) => void;
  status?: string;
  onStatusChange?: (v: string) => void;
  showStatus?: boolean;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  totalMatching: number | null;
  loading: boolean;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-[color-mix(in_srgb,var(--color-border)_90%,transparent)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">{title}</p>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:items-end",
          showStatus ? "xl:grid-cols-6" : "xl:grid-cols-5",
        )}
      >
        <div className="relative xl:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-muted)]">Search</label>
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
              placeholder="Content or @username…"
              className={cn(inputCls, "bg-[var(--color-cream)] pl-9")}
            />
          </div>
        </div>
        <AdminSelect label="Category" value={category} onChange={onCategoryChange}>
          {POST_CATEGORY_FILTER_OPTIONS.map((o) => (
            <option key={o.value === "" ? "__all" : o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect label="Media" value={media} onChange={onMediaChange}>
          <option value="all">All types</option>
          <option value="none">Text only</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </AdminSelect>
        {showStatus ? (
          <AdminSelect label="Status" value={status ?? "all"} onChange={(v) => onStatusChange?.(v)}>
            <option value="all">Approved + declined</option>
            <option value="approved">Approved only</option>
            <option value="declined">Declined only</option>
          </AdminSelect>
        ) : null}
        <AdminSelect label="Per page" value={String(pageSize)} onChange={(v) => onPageSizeChange(Number(v))}>
          <option value="15">15</option>
          <option value="20">20</option>
          <option value="25">25</option>
          <option value="40">40</option>
          <option value="50">50</option>
        </AdminSelect>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-3 text-[12px] text-[var(--color-muted)]">
        <span>
          {totalMatching != null ? (
            <>
              <strong className="font-semibold text-[var(--color-primary)]">{totalMatching}</strong> matching
            </>
          ) : (
            "…"
          )}
        </span>
        <span>Use the pager below to move between pages.</span>
        {loading ? <span className="text-[var(--color-flame)]">Updating…</span> : null}
      </div>
    </div>
  );
}
