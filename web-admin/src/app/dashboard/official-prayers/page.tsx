"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import { ScheduledDateBadge, SlotBadge } from "@/components/dashboard/SanctuaryGuideForm";
import { btnGhost, btnDangerOutline, btnPrimary, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { normalizeScheduledDate } from "@/lib/date";

interface OfficialPrayer {
  id: number;
  title: string;
  subtitle: string | null;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
  scheduleSlot: string | null;
  scheduledDate: string | null;
  label: string | null;
}

type SlotFilter = "all" | "morning" | "evening";

export default function OfficialPrayersPage() {
  const { token } = useAuth();
  const [prayers, setPrayers] = useState<OfficialPrayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 320);
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminFetch("/library/official?limit=120", token);
      if (!res.ok) return;
      const data = await res.json();
      const rows: OfficialPrayer[] = data.prayers ?? data.items ?? data ?? [];
      const sanctuaryRows = rows
        .filter((p) => p.scheduleSlot === "morning" || p.scheduleSlot === "evening")
        .map((p) => ({
          ...p,
          scheduledDate: p.scheduledDate ? normalizeScheduledDate(p.scheduledDate) : null,
        }));
      sanctuaryRows.sort((a, b) => {
        const dateCmp = (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? "");
        if (dateCmp !== 0) return dateCmp;
        const order: Record<string, number> = { morning: 0, evening: 1 };
        return (order[a.scheduleSlot ?? ""] ?? 99) - (order[b.scheduleSlot ?? ""] ?? 99);
      });
      setPrayers(sanctuaryRows);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPrayers = useMemo(() => {
    return prayers.filter((p) => {
      if (slotFilter === "morning" && p.scheduleSlot !== "morning") return false;
      if (slotFilter === "evening" && p.scheduleSlot !== "evening") return false;
      if (audioFilter === "yes" && !(p.audioUrl && String(p.audioUrl).trim())) return false;
      if (audioFilter === "no" && Boolean(p.audioUrl && String(p.audioUrl).trim())) return false;
      const q = debouncedListSearch.trim().toLowerCase();
      if (q) {
        const hay = `${p.title}\n${p.subtitle ?? ""}\n${p.scripture ?? ""}\n${p.label ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [prayers, slotFilter, audioFilter, debouncedListSearch]);

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this guide?")) return;
    await adminFetch(`/admin/official-prayers/${id}`, token, { method: "DELETE" });
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <PageHeader
        title="Official guides"
        action={
          <Link href="/dashboard/official-prayers/new" className={btnPrimary + " inline-flex items-center gap-1.5"}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Link>
        }
      />

      <LibraryContentFiltersCard
        search={listSearch}
        onSearchChange={setListSearch}
        slotFilter={slotFilter}
        onSlotFilterChange={(v) => setSlotFilter(v === "none" ? "all" : v)}
        audioFilter={audioFilter}
        onAudioFilterChange={setAudioFilter}
        showingCount={filteredPrayers.length}
        totalCount={prayers.length}
        slotFilterVisible
        hideNoSlotFilterOption
      />

      {loading ? (
        <Spinner />
      ) : filteredPrayers.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-[var(--color-muted)]">
          {prayers.length === 0 ? "No guides yet" : "No guides match filters"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredPrayers.map((p) => (
            <div key={p.id} className={`${panelCls} flex items-center justify-between gap-3 p-3`}>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  {p.scheduleSlot ? <SlotBadge slot={p.scheduleSlot} /> : null}
                  <ScheduledDateBadge scheduledDate={p.scheduledDate} />
                  {p.audioUrl ? (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Audio</span>
                  ) : null}
                  {p.durationMinutes ? (
                    <span className="text-[10px] text-[var(--color-muted)]">{p.durationMinutes} min</span>
                  ) : null}
                </div>
                <p className="truncate text-[13px] font-semibold text-[var(--color-primary)]">{p.title}</p>
                {p.subtitle ? <p className="truncate text-[11px] text-[var(--color-muted)]">{p.subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Link href={`/dashboard/official-prayers/${p.id}/edit`} className={btnGhost}>
                  Edit
                </Link>
                <button type="button" onClick={() => void handleDelete(p.id)} className={btnDangerOutline}>
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
