"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { btnDangerOutline, btnGhost, btnPrimary, panelCls } from "@/components/dashboard/form-styles";
import { isDefaultLibraryPathCategory } from "@/config/default-library-paths";
import { Spinner } from "@/components/ui/feedback";
import { categoryLabel } from "@/config/post-categories";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";

type PathGuide = {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
};

type PathDetail = {
  id: number;
  name: string;
  description: string;
  category: string;
  tagline: string | null;
};

export default function PathDetailPage() {
  const params = useParams();
  const pathId = Number(params.pathId);
  const { token } = useAuth();
  const [path, setPath] = useState<PathDetail | null>(null);
  const [guides, setGuides] = useState<PathGuide[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(pathId)) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/library/paths/${pathId}`, token);
      if (!res.ok) {
        setPath(null);
        return;
      }
      const data = await res.json();
      if (!isDefaultLibraryPathCategory(data.category ?? "")) {
        setPath(null);
        return;
      }
      setPath({
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        tagline: data.tagline ?? null,
      });
      setGuides(data.officialPrayers ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, pathId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteGuide = async (id: number) => {
    if (!token || !confirm("Delete this guide from the path?")) return;
    await adminFetch(`/admin/official-prayers/${id}`, token, { method: "DELETE" });
    setGuides((prev) => prev.filter((g) => g.id !== id));
  };

  if (loading) return <Spinner />;

  if (!path) {
    return (
      <>
        <PageHeader title="Path not found" backHref="/dashboard/paths" backLabel="Category guides" />
        <p className="text-[12px] text-[var(--color-muted)]">This category is not one of the 12 library paths.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={path.name}
        description={`${categoryLabel(path.category)} · ${guides.length} guide${guides.length === 1 ? "" : "s"}`}
        backHref="/dashboard/paths"
        backLabel="Category guides"
        action={
          <Link
            href={`/dashboard/paths/${pathId}/guides/new`}
            className={btnPrimary + " inline-flex items-center gap-1.5"}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add guide
          </Link>
        }
      />

      <div className={`${panelCls} mb-3 p-3`}>
        {path.tagline ? <p className="text-[12px] font-medium text-[var(--color-accent)]">{path.tagline}</p> : null}
        <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{path.description}</p>
      </div>

      {guides.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[var(--color-muted)]">No guides on this path yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {guides.map((g) => (
            <div key={g.id} className={`${panelCls} flex items-center justify-between gap-3 p-3`}>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  {g.audioUrl ? (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Audio</span>
                  ) : (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">No audio</span>
                  )}
                  {g.durationMinutes ? (
                    <span className="text-[10px] text-[var(--color-muted)]">{g.durationMinutes} min</span>
                  ) : null}
                </div>
                <p className="truncate text-[13px] font-semibold text-[var(--color-primary)]">{g.title}</p>
                {g.subtitle ? <p className="truncate text-[11px] text-[var(--color-muted)]">{g.subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Link href={`/dashboard/paths/${pathId}/guides/${g.id}/edit`} className={btnGhost}>
                  Edit
                </Link>
                <button type="button" onClick={() => void deleteGuide(g.id)} className={btnDangerOutline}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
