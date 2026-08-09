"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PostStatusBadge, ReportedBadge } from "@/components/dashboard/AdminPostBody";
import { panelCls } from "@/components/dashboard/form-styles";
import { AdminPostFiltersCard } from "@/components/dashboard/AdminPostFiltersCard";
import { AdminPaginationBar } from "@/components/dashboard/AdminPaginationBar";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Post {
  id: number;
  content: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  createdAt: string;
  prayCount: number;
  category: string | null;
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
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 380);
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [totalMatching, setTotalMatching] = useState<number | null>(null);
  const prevFiltersRef = useRef<PostsFiltersSnapshot | null>(null);

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
        const params = new URLSearchParams({ limit: String(next.pageSize), page: String(effectivePage) });
        if (next.q) params.set("q", next.q);
        if (next.category) params.set("category", next.category);
        if (next.media !== "all") params.set("media", next.media);
        if (next.statusFilter !== "all") params.set("status", next.statusFilter);
        const res = await adminFetch(`/admin/posts/moderated?${params}`, token);
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
  }, [token, debouncedSearch, category, media, statusFilter, pageSize, page]);

  const filtersActive = Boolean(debouncedSearch.trim() || category.trim() || media !== "all" || statusFilter !== "all");

  return (
    <>
      <PageHeader title="All posts" />

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
      ) : posts.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted">
          {filtersActive ? "No matches" : "No posts"}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/dashboard/posts/${post.id}`}
                className={`${panelCls} block px-2.5 py-2 transition-colors hover:border-flame`}
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-medium text-primary">
                    {post.isAnonymous ? "Anon" : (post.authorDisplayName ?? post.authorUsername ?? "—")}
                  </span>
                  <PostStatusBadge status={post.status} />
                  {post.status === "pending" ? <ReportedBadge /> : null}
                  <span className="ml-auto text-[10px] text-muted">
                    {new Date(post.createdAt).toLocaleDateString()} · {post.prayCount} 🙏
                  </span>
                </div>
                <p className="line-clamp-1 text-[11px] text-text-secondary">{post.content}</p>
              </Link>
            ))}
          </div>
          {totalMatching != null && totalMatching > 0 ? (
            <AdminPaginationBar
              className="mt-2"
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
