"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { inputCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface OfficialPrayer {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  category: string;
  label: string | null;
  scheduleSlot: string | null;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
}

type Draft = Partial<
  Pick<OfficialPrayer, "title" | "subtitle" | "scripture" | "audioUrl" | "durationMinutes">
>;

type SlotFilter = "all" | "morning" | "evening";

export default function OfficialPrayersPage() {
  const { token } = useAuth();
  const [prayers, setPrayers] = useState<OfficialPrayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<
    Partial<OfficialPrayer & { scheduleSlot: "morning" | "evening" }>
  >({ scheduleSlot: "morning" });
  const [createSaving, setCreateSaving] = useState(false);

  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 320);
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");

  const filteredPrayers = useMemo(() => {
    return prayers.filter((p) => {
      if (slotFilter === "morning" && p.scheduleSlot !== "morning") return false;
      if (slotFilter === "evening" && p.scheduleSlot !== "evening") return false;
      if (audioFilter === "yes" && !(p.audioUrl && String(p.audioUrl).trim())) return false;
      if (audioFilter === "no" && Boolean(p.audioUrl && String(p.audioUrl).trim())) return false;
      const q = debouncedListSearch.trim().toLowerCase();
      if (q) {
        const hay =
          `${p.title}\n${p.subtitle ?? ""}\n${p.scripture ?? ""}\n${p.label ?? ""}\n${p.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [prayers, slotFilter, audioFilter, debouncedListSearch]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/library/official"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const rows: OfficialPrayer[] = data.prayers ?? data.items ?? data ?? [];
      const sanctuaryRows = rows.filter(
        (p) => p.scheduleSlot === "morning" || p.scheduleSlot === "evening",
      );
      sanctuaryRows.sort((a, b) => {
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

  const startEdit = (p: OfficialPrayer) => {
    setEditId(p.id);
    setDraft({
      title: p.title,
      subtitle: p.subtitle ?? "",
      scripture: p.scripture ?? "",
      audioUrl: p.audioUrl ?? "",
      durationMinutes: p.durationMinutes ?? undefined,
    });
  };

  const save = async () => {
    if (!token || editId === null) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${editId}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.prayer ?? data;
        setPrayers((prev) => prev.map((p) => (p.id === editId ? { ...p, ...updated } : p)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this official prayer?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), { method: "DELETE", headers: authHeaders(token) });
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  };

  const createNew = async () => {
    if (!token || !newDraft.title?.trim() || !newDraft.scheduleSlot) return;
    setCreateSaving(true);
    try {
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: newDraft.title,
          subtitle: newDraft.subtitle ?? null,
          scripture: newDraft.scripture?.trim() ? newDraft.scripture.trim() : null,
          audioUrl: newDraft.audioUrl?.trim() ? newDraft.audioUrl.trim() : null,
          durationMinutes: newDraft.durationMinutes,
          category: "sanctuary",
          scheduleSlot: newDraft.scheduleSlot,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        setPrayers((prev) => [...prev, row]);
        setCreating(false);
        setNewDraft({ scheduleSlot: "morning" });
      }
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Official guides"
        description="Morning and evening sanctuary audio — each guide is assigned to one slot"
        action={
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setNewDraft({ scheduleSlot: "morning" });
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#252c4a]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New
          </button>
        }
      />

      {creating && (
        <div className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--color-flame)_40%,var(--color-border))] bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="mb-4 text-[13px] font-semibold text-[var(--color-primary)]">New sanctuary guide</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title *">
              <input
                className={inputCls}
                placeholder="Title"
                value={newDraft.title ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </Field>
            <AdminSelect
              label="Schedule slot *"
              value={newDraft.scheduleSlot ?? "morning"}
              onChange={(v) =>
                setNewDraft((d) => ({
                  ...d,
                  scheduleSlot: v === "evening" ? "evening" : "morning",
                }))
              }
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </AdminSelect>
            <Field label="Subtitle" className="sm:col-span-2">
              <input
                className={inputCls}
                placeholder="Short line under the title (optional)"
                value={newDraft.subtitle ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="Scripture" className="sm:col-span-2">
              <input
                className={inputCls}
                placeholder="e.g. Psalm 23:1"
                value={newDraft.scripture ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, scripture: e.target.value }))}
              />
            </Field>
            <AdminAudioField
              className="sm:col-span-2"
              token={token}
              disabled={createSaving}
              value={newDraft.audioUrl ?? ""}
              onChange={(audioUrl) => setNewDraft((d) => ({ ...d, audioUrl }))}
            />
            <Field label="Duration (min)">
              <input
                className={inputCls}
                type="number"
                value={newDraft.durationMinutes ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))}
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => void createNew()}
              disabled={createSaving || !newDraft.title?.trim()}
              className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {createSaving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewDraft({ scheduleSlot: "morning" });
              }}
              className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
      ) : (
        <div className="flex flex-col gap-3">
          {!loading && prayers.length > 0 && filteredPrayers.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No guides match these filters — reset search or slot/audio filters
            </div>
          )}
          {filteredPrayers.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              {editId === p.id ? (
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {p.scheduleSlot && <SlotBadge slot={p.scheduleSlot} />}
                    <span className="text-[11px] text-[var(--color-muted)]">ID #{p.id}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Title">
                      <input
                        className={inputCls}
                        value={draft.title ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    </Field>
                    <Field label="Subtitle">
                      <input
                        className={inputCls}
                        value={draft.subtitle ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
                      />
                    </Field>
                    <Field label="Scripture" className="sm:col-span-2">
                      <input
                        className={inputCls}
                        value={draft.scripture ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, scripture: e.target.value }))}
                      />
                    </Field>
                    <AdminAudioField
                      className="sm:col-span-2"
                      token={token}
                      disabled={saving}
                      value={draft.audioUrl ?? ""}
                      onChange={(audioUrl) => setDraft((d) => ({ ...d, audioUrl }))}
                    />
                    <Field label="Duration (min)">
                      <input
                        className={inputCls}
                        type="number"
                        value={draft.durationMinutes ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void save()}
                      disabled={saving}
                      className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {p.scheduleSlot && <SlotBadge slot={p.scheduleSlot} />}
                      {p.label && (
                        <span className="rounded-full bg-[#F9F6F0] px-2 py-0.5 text-[11px] text-[#8A8FA8]">{p.label}</span>
                      )}
                      {p.audioUrl && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
                          Audio
                        </span>
                      )}
                      {p.durationMinutes ? (
                        <span className="text-[11px] text-[#8A8FA8]">{p.durationMinutes} min</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-[#1A1F36]">{p.title}</p>
                    {p.subtitle && <p className="mt-0.5 text-[12px] text-[#8A8FA8]">{p.subtitle}</p>}
                    {p.scripture && <p className="mt-1.5 text-[11px] text-[#D4A043]">{p.scripture}</p>}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded-lg border border-[#E8E4DC] px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-[#F97316]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      className="rounded-lg border border-[#EF4444]/40 px-3 py-1.5 text-[12px] text-[#EF4444] transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {prayers.length === 0 && (
            <div className="py-16 text-center text-[13px] text-[var(--color-muted)]">No official prayers loaded yet</div>
          )}
        </div>
      )}
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      {children}
    </div>
  );
}

function SlotBadge({ slot }: { slot: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        slot === "morning" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
      }`}
    >
      {slot === "morning" ? "Morning" : "Evening"}
    </span>
  );
}
