"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderTree } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { inputCls, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { filterDefaultLibraryPaths } from "@/config/default-library-paths";
import { categoryLabel } from "@/config/post-categories";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type PathSummary = {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  tagline: string | null;
  prayerCount: number;
};

export default function PathsPage() {
  const { token } = useAuth();
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathSearch, setPathSearch] = useState("");
  const debouncedPathSearch = useDebouncedValue(pathSearch, 280);

  const loadPaths = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminFetch("/library/paths", token);
      if (!res.ok) return;
      const data = await res.json();
      setPaths(
        (data.paths ?? []).map((p: PathSummary) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          category: p.category,
          tagline: p.tagline ?? null,
          prayerCount: p.prayerCount ?? 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  const defaultPaths = useMemo(() => filterDefaultLibraryPaths(paths), [paths]);

  const filteredPaths = useMemo(() => {
    const q = debouncedPathSearch.trim().toLowerCase();
    if (!q) return defaultPaths;
    return defaultPaths.filter((p) => {
      const hay = `${p.name}\n${p.description}\n${p.category}\n${p.tagline ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [defaultPaths, debouncedPathSearch]);

  return (
    <>
      <PageHeader
        title="Category guides"
        description="13 For your situation categories — same order as the app. Add guides under each path."
      />

      {loading ? (
        <Spinner />
      ) : defaultPaths.length === 0 ? (
        <div className="py-10 text-center">
          <FolderTree className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
          <p className="text-[12px] text-muted">No library paths yet — run the library seed on the API server.</p>
        </div>
      ) : (
        <>
          <input
            className={`${inputCls} mb-3 max-w-md`}
            placeholder="Search paths…"
            value={pathSearch}
            onChange={(e) => setPathSearch(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPaths.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/paths/${p.id}`}
                className={`${panelCls} block p-3 transition-colors hover:border-flame`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {categoryLabel(p.category)}
                  </span>
                  <span className="text-[10px] text-muted">
                    {p.prayerCount} guide{p.prayerCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-primary">{p.name}</p>
                {p.tagline ? <p className="mt-0.5 text-[11px] text-accent">{p.tagline}</p> : null}
                {p.description?.trim() ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">
                    {p.description}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
          {filteredPaths.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">No paths match search</p>
          ) : null}
        </>
      )}
    </>
  );
}
