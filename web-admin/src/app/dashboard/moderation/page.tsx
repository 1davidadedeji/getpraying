"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminPostFiltersCard } from "@/components/dashboard/AdminPostFiltersCard";
import { AdminPaginationBar } from "@/components/dashboard/AdminPaginationBar";
import { panelCls } from "@/components/dashboard/form-styles";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Post {
  id: number;
  content: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  createdAt: string;
  category: string | null;
  mediaType: string | null;
  isAnonymous: boolean;
  reports?: { reporterUsername: string }[];
}

type ModerationFiltersSnapshot = {
  q: string;
  category: string;
  media: string;
  pageSize: number;
};

export default function ModerationPage() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 380);
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [totalMatching, setTotalMatching] = useState<number | null>(null);
  const prevFiltersRef = useRef<ModerationFiltersSnapshot | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl("/admin/pending-count"), { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPendingCount(d.count);
      })
      .catch(() => {});
  }, [token, refreshTick]);

  useEffect(() => {
    if (!token) return;
    const next: ModerationFiltersSnapshot = {
      q: debouncedSearch.trim(),
      category: category.trim(),
      media,
      pageSize,
    };
    const prev = prevFiltersRef.current;
    const changed =
      !prev ||
      prev.q !== next.q ||
      prev.category !== next.category ||
      prev.media !== next.media ||
      prev.pageSize !== next.pageSize;
    prevFiltersRef.current = next;
    const effectivePage = changed ? 1 : page;
    if (changed && page !== 1) setPage(1);

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ limit: String(next.pageSize), page: String(effectivePage) });
        if (next.q) params.set("q", next.q);
        if (next.category) params.set("category", next.category);
        if (next.media !== "all") params.set("media", next.media);
        const res = await fetch(apiUrl(`/admin/posts/pending?${params}`), { headers: authHeaders(token) });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts ?? []);
        setTotalMatching(typeof data.totalMatching === "number" ? data.totalMatching : null);
        setTotalPages(typeof data.totalPages === "number" ? Math.max(1, data.totalPages) : 1);
        if (typeof data.page === "number") setPage(data.page);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, debouncedSearch, category, media, pageSize, page, refreshTick]);

  const filtersActive = Boolean(debouncedSearch.trim() || category.trim() || media !== "all");

  return (
    <>
      <PageHeader
        title="Moderation"
        description="Review pending posts"
        action={
          pendingCount !== null ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                pendingCount > 0 ? "bg-[var(--color-flame)] text-white" : "bg-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {pendingCount} pending
            </span>
          ) : null
        }
      />

      <AdminPostFiltersCard
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        media={media}
        onMediaChange={setMedia}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalMatching={totalMatching}
        loading={loading}
      />

      {loading && posts.length === 0 ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <EmptyState label={filtersActive ? "No posts match filters" : "Queue is clear"} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/dashboard/moderation/${post.id}`}
                className={`${panelCls} block p-3 transition-colors hover:border-[var(--color-flame)]`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--color-primary)]">
                    {post.isAnonymous ? "Anonymous" : (post.authorDisplayName ?? post.authorUsername ?? "Unknown")}
                  </span>
                  {!post.isAnonymous && post.authorUsername ? (
                    <span className="text-[10px] text-[var(--color-muted)]">@{post.authorUsername}</span>
                  ) : null}
                  {post.category ? (
                    <span className="rounded bg-[var(--color-flame)]/10 px-1.5 py-0.5 text-[10px] capitalize text-[var(--color-flame)]">
                      {post.category}
                    </span>
                  ) : null}
                  {(post.reports?.length ?? 0) > 0 ? (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-danger)]">
                      {post.reports!.length} report{post.reports!.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                    {new Date(post.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="line-clamp-2 text-[12px] leading-snug text-[var(--color-text-secondary)]">{post.content}</p>
              </Link>
            ))}
          </div>
          {totalMatching != null && totalMatching > 0 ? (
            <AdminPaginationBar
              className="mt-3"
              page={page}
              totalPages={totalPages}
              totalMatching={totalMatching}
              pageSize={pageSize}
              loading={loading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </>
  );
}
