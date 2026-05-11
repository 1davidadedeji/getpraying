"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminPostFiltersCard } from "@/components/dashboard/AdminPostFiltersCard";
import { AdminPaginationBar } from "@/components/dashboard/AdminPaginationBar";
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
  prayCount: number;
  category: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isAnonymous: boolean;
  status: string;
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
  const [actionId, setActionId] = useState<number | null>(null);
  const [declineId, setDeclineId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
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
        const params = new URLSearchParams({
          limit: String(next.pageSize),
          page: String(effectivePage),
        });
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

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl("/admin/pending-count"), { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPendingCount(d.count);
      })
      .catch(() => {});
  }, [token]);

  const approve = async (id: number) => {
    if (!token) return;
    setActionId(id);
    try {
      await fetch(apiUrl(`/admin/posts/${id}/approve`), { method: "POST", headers: authHeaders(token) });
      setPendingCount((n) => (n ?? 1) - 1);
      fetch(apiUrl("/admin/pending-count"), { headers: authHeaders(token) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.count === "number") setPendingCount(d.count);
        })
        .catch(() => {});
      setRefreshTick((t) => t + 1);
    } finally {
      setActionId(null);
    }
  };

  const decline = async (id: number) => {
    if (!token || declineReason.trim().length < 3) return;
    setActionId(id);
    try {
      await fetch(apiUrl(`/admin/posts/${id}/decline`), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      setPendingCount((n) => (n ?? 1) - 1);
      fetch(apiUrl("/admin/pending-count"), { headers: authHeaders(token) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.count === "number") setPendingCount(d.count);
        })
        .catch(() => {});
      setRefreshTick((t) => t + 1);
    } finally {
      setActionId(null);
      setDeclineId(null);
      setDeclineReason("");
    }
  };

  const filtersActive = Boolean(debouncedSearch.trim() || category.trim() || media !== "all");

  return (
    <>
      <PageHeader
        title="Moderation queue"
        description="Review pending posts — filter by text, category, or media type"
        action={
          pendingCount !== null ? (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${
                pendingCount > 0 ? "bg-[var(--color-flame)] text-white" : "bg-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {pendingCount} pending (global)
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
        <EmptyState
          label={
            filtersActive
              ? "No pending posts match these filters — try clearing search or media filters"
              : "Queue is clear — nothing pending review"
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--color-primary)]">
                      {post.isAnonymous ? "Anonymous" : (post.authorDisplayName ?? post.authorUsername ?? "Unknown")}
                    </span>
                    {!post.isAnonymous && post.authorUsername && (
                      <span className="text-[11px] text-[var(--color-muted)]">@{post.authorUsername}</span>
                    )}
                    {post.category && <CategoryBadge category={post.category} />}
                    {post.mediaType && (
                      <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] capitalize text-blue-600">
                        {post.mediaType}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-[var(--color-muted)]">
                      {new Date(post.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-primary)] whitespace-pre-wrap">{post.content}</p>
                </div>
              </div>

              {declineId === post.id ? (
                <div className="mt-3 flex items-start gap-2">
                  <input
                    autoFocus
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-[13px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
                    placeholder="Reason for declining (required)…"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void decline(post.id);
                      if (e.key === "Escape") {
                        setDeclineId(null);
                        setDeclineReason("");
                      }
                    }}
                  />
                  <button
                    disabled={declineReason.trim().length < 3 || actionId === post.id}
                    onClick={() => void decline(post.id)}
                    className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                  >
                    {actionId === post.id ? "…" : "Decline"}
                  </button>
                  <button
                    onClick={() => {
                      setDeclineId(null);
                      setDeclineReason("");
                    }}
                    className="rounded-lg bg-[var(--color-border)] px-3 py-2 text-[13px] text-[var(--color-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={actionId === post.id}
                    onClick={() => void approve(post.id)}
                    className="rounded-lg bg-[var(--color-success)] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
                  >
                    {actionId === post.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => {
                      setDeclineId(post.id);
                      setDeclineReason("");
                    }}
                    className="rounded-lg border border-[var(--color-danger)] px-3.5 py-1.5 text-[13px] text-[var(--color-danger)] transition-colors hover:bg-red-50"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}

          {totalMatching != null && totalMatching > 0 ? (
            <AdminPaginationBar
              className="mt-1"
              page={page}
              totalPages={totalPages}
              totalMatching={totalMatching}
              pageSize={pageSize}
              loading={loading}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--color-flame)_14%,var(--color-cream))] px-1.5 py-0.5 text-[11px] font-medium capitalize text-[var(--color-flame)]">
      {category}
    </span>
  );
}
