"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import { LectureSeriesPreview } from "@/components/dashboard/LectureSeriesPreview";
import { btnGhost, btnDangerOutline, btnPrimary, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface LectureTrack {
  id: number;
  title: string;
  description: string | null;
  audioUrl: string;
  orderIndex: number;
}

interface Lecture {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  scripture: string | null;
  durationMinutes: number | null;
  tracks?: LectureTrack[];
}

function hasAudio(l: Lecture): boolean {
  return (l.tracks?.length ?? 0) > 0;
}

export default function LecturesPage() {
  const { token } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 320);
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/library/official?category=lectures&limit=60"), {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = await res.json();
      setLectures(data.prayers ?? data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLectures = useMemo(() => {
    return lectures.filter((l) => {
      if (audioFilter === "yes" && !hasAudio(l)) return false;
      if (audioFilter === "no" && hasAudio(l)) return false;
      const q = debouncedListSearch.trim().toLowerCase();
      if (q) {
        const trackHay = (l.tracks ?? []).map((t) => `${t.title} ${t.description ?? ""}`).join("\n");
        const hay = `${l.title}\n${l.subtitle ?? ""}\n${l.content}\n${l.scripture ?? ""}\n${trackHay}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lectures, audioFilter, debouncedListSearch]);

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this lesson and all audio parts?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), { method: "DELETE", headers: authHeaders(token) });
    setLectures((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <>
      <PageHeader
        title="Lectures"
        description="Library lessons with multi-part audio"
        action={
          <Link href="/dashboard/lectures/new" className={btnPrimary + " inline-flex items-center gap-1.5"}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New lesson
          </Link>
        }
      />

      <LibraryContentFiltersCard
        search={listSearch}
        onSearchChange={setListSearch}
        slotFilter="all"
        onSlotFilterChange={() => {}}
        audioFilter={audioFilter}
        onAudioFilterChange={setAudioFilter}
        showingCount={filteredLectures.length}
        totalCount={lectures.length}
        slotFilterVisible={false}
      />

      {loading ? (
        <Spinner />
      ) : filteredLectures.length === 0 ? (
        <div className="py-10 text-center">
          <BookOpen className="mx-auto mb-2 h-6 w-6 text-[var(--color-muted)]" aria-hidden />
          <p className="text-[12px] text-[var(--color-muted)]">
            {lectures.length === 0 ? "No lessons yet" : "No lessons match filters"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredLectures.map((l) => (
            <div key={l.id} className={`${panelCls} p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {hasAudio(l) ? (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        {l.tracks!.length} part{l.tracks!.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">No audio</span>
                    )}
                    {l.durationMinutes ? (
                      <span className="text-[10px] text-[var(--color-muted)]">{l.durationMinutes} min</span>
                    ) : null}
                  </div>
                  <p className="text-[13px] font-semibold text-[var(--color-primary)]">{l.title}</p>
                  {l.subtitle ? <p className="text-[11px] text-[var(--color-muted)]">{l.subtitle}</p> : null}
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-text-secondary)]">{l.content}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Link href={`/dashboard/lectures/${l.id}/edit`} className={btnGhost}>
                    Edit
                  </Link>
                  <button type="button" onClick={() => void handleDelete(l.id)} className={btnDangerOutline}>
                    Delete
                  </button>
                </div>
              </div>
              {(l.tracks?.length ?? 0) > 0 ? (
                <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                  <LectureSeriesPreview tracks={l.tracks ?? []} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
