"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { panelCls } from "@/components/dashboard/form-styles";
import { AdminPostFiltersCard } from "@/components/dashboard/AdminPostFiltersCard";
import { AdminPaginationBar } from "@/components/dashboard/AdminPaginationBar";
import { Spinner } from "@/components/ui/feedback";
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
  mediaType: string | null;
  isAnonymous: boolean;
  status: string;
  moderationReason: string | null;
}

type PostsFiltersSnapshot = {
  q: string;
  category: string;
  media: string;
  statusFilter: string;
  pageSize: number;
};

export default function PostsPage() {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [requeueId, setRequeueId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 380);
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [totalMatching, setTotalMatching] = useState<number | null>(null);

  const prevFiltersRef = useRef<PostsFiltersSnapshot | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!token) return;

    const next: PostsFiltersSnapshot = {
      q: debouncedSearch.trim(),
      category: category.trim(),
      media,
      statusFilter,
      pageSize,
    };
    const prev = prevFiltersRef.current;
    const changed =
      !prev ||
      prev.q !== next.q ||
      prev.category !== next.category ||
      prev.media !== next.media ||
      prev.statusFilter !== next.statusFilter ||
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
        if (next.statusFilter !== "all") params.set("status", next.statusFilter);
        const res = await fetch(apiUrl(`/admin/posts/moderated?${params}`), { headers: authHeaders(token) });
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
  }, [token, debouncedSearch, category, media, statusFilter, pageSize, page, refreshTick]);

  const removePost = async (id: number) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await fetch(apiUrl(`/admin/posts/${id}/remove`), {
        method: "DELETE",
        headers: authHeaders(token),
        body: JSON.stringify({ reason: reason.trim() || "Admin removal" }),
      });
      setRefreshTick((t) => t + 1);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
      setReason("");
    }
  };

  const requeue = async (id: number) => {
    if (!token) return;
    setRequeueId(id);
    try {
      await fetch(apiUrl(`/admin/posts/${id}/requeue`), { method: "POST", headers: authHeaders(token) });
      setRefreshTick((t) => t + 1);
    } finally {
      setRequeueId(null);
    }
  };

  const filtersActive = Boolean(debouncedSearch.trim() || category.trim() || media !== "all" || statusFilter !== "all");

  return (
    <>
      <PageHeader title="All posts" description="Approved and declined — filter and paginate" />

      <AdminPostFiltersCard
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        media={media}
        onMediaChange={setMedia}
        showStatus
        status={statusFilter}
        onStatusChange={setStatusFilter}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalMatching={totalMatching}
        loading={loading}
      />

      {loading && posts.length === 0 ? (
        <Spinner />
      ) : (
        <>
          <div className={`${panelCls} overflow-x-auto`}>
            <table className="w-full min-w-[600px] text-[12px]">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-cream)]/60">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-primary)]">Author</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-primary)]">Content</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-primary)]">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-primary)]">🙏</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--color-primary)]">Date</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-cream)]/40"
                  >
                    <td className="px-3 py-2">
                      <p className="max-w-[120px] truncate font-medium text-[var(--color-primary)]">
                        {post.isAnonymous ? <span className="text-[var(--color-muted)]">Anon</span> : (post.authorDisplayName ?? post.authorUsername ?? "—")}
                      </p>
                      {!post.isAnonymous && post.authorUsername && (
                        <p className="text-[11px] text-[var(--color-muted)]">@{post.authorUsername}</p>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      <p className="truncate text-[var(--color-text-secondary)]">{post.content}</p>
                      {post.moderationReason && (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--color-danger)]">↳ {post.moderationReason}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{post.prayCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--color-muted)]">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {confirmId === post.id ? (
                        <div className="flex min-w-[180px] flex-col gap-1.5">
                          <input
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-[12px]"
                            placeholder="Reason (optional)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => void removePost(post.id)}
                              disabled={deletingId === post.id}
                              className="rounded-lg bg-[var(--color-danger)] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                            >
                              {deletingId === post.id ? "…" : "Remove"}
                            </button>
                            <button
                              onClick={() => {
                                setConfirmId(null);
                                setReason("");
                              }}
                              className="rounded-lg bg-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-primary)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {isAdmin && post.status === "declined" && (
                            <button
                              onClick={() => void requeue(post.id)}
                              disabled={requeueId === post.id}
                              className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-flame)] hover:text-[var(--color-flame)] disabled:opacity-40"
                            >
                              {requeueId === post.id ? "…" : "Re-queue"}
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmId(post.id)}
                              className="rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] px-2.5 py-1 text-[12px] text-[var(--color-danger)] transition-colors hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-muted)]">
                      {filtersActive
                        ? "No posts match these filters — widen status or clear search"
                        : "No moderated posts in this batch"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-50 text-green-700",
    declined: "bg-red-50 text-[var(--color-danger)]",
    pending: "bg-yellow-50 text-yellow-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${map[status] ?? "bg-[var(--color-border)] text-[var(--color-muted)]"}`}
    >
      {status}
    </span>
  );
}
