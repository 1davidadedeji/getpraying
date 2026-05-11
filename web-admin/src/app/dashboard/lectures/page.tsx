"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import { inputCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Lecture {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
  createdAt: string;
}

type Draft = Partial<Pick<Lecture, "title" | "subtitle" | "content" | "scripture" | "audioUrl" | "durationMinutes">>;

export default function LecturesPage() {
  const { token } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Partial<Lecture>>({});
  const [createSaving, setCreateSaving] = useState(false);

  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 320);
  const [slotFilter, setSlotFilter] = useState<"all" | "morning" | "evening" | "none">("all");
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");

  const filteredLectures = useMemo(() => {
    return lectures.filter((l) => {
      if (audioFilter === "yes" && !(l.audioUrl && String(l.audioUrl).trim())) return false;
      if (audioFilter === "no" && Boolean(l.audioUrl && String(l.audioUrl).trim())) return false;
      const q = debouncedListSearch.trim().toLowerCase();
      if (q) {
        const hay = `${l.title}\n${l.subtitle ?? ""}\n${l.content}\n${l.scripture ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lectures, audioFilter, debouncedListSearch]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/library/official?category=lectures"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      setLectures(data.prayers ?? data.items ?? []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (l: Lecture) => {
    setEditId(l.id);
    setDraft({ title: l.title, subtitle: l.subtitle ?? "", content: l.content, scripture: l.scripture ?? "", audioUrl: l.audioUrl ?? "", durationMinutes: l.durationMinutes ?? undefined });
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
        setLectures((prev) => prev.map((l) => l.id === editId ? { ...l, ...updated } : l));
        setEditId(null);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this lecture?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), { method: "DELETE", headers: authHeaders(token) });
    setLectures((prev) => prev.filter((l) => l.id !== id));
  };

  const createLecture = async () => {
    if (!token || !newDraft.title?.trim() || !newDraft.content?.trim()) return;
    setCreateSaving(true);
    try {
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ ...newDraft, category: "lectures" }),
      });
      if (res.ok) {
        const row = await res.json();
        setLectures((prev) => [...prev, row]);
        setCreating(false);
        setNewDraft({});
      }
    } finally { setCreateSaving(false); }
  };

  return (
    <>
      <PageHeader
        title="Lectures"
        description="Carousel lectures — search and filter without scrolling the whole library"
        action={
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setNewDraft({});
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#252c4a]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New
          </button>
        }
      />

      {/* Create form */}
      {creating && (
        <div className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--color-flame)_40%,var(--color-border))] bg-[var(--color-surface)] p-4">
          <p className="mb-3 text-[13px] font-semibold text-[var(--color-primary)]">New lecture</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title *"><input className={inputCls} placeholder="Title" value={newDraft.title ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))} /></Field>
            <Field label="Subtitle"><input className={inputCls} placeholder="Subtitle" value={newDraft.subtitle ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, subtitle: e.target.value }))} /></Field>
          </div>
          <Field label="Content *" className="mt-3">
            <textarea className={`${inputCls} resize-none`} rows={4} value={newDraft.content ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, content: e.target.value }))} />
          </Field>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Scripture"><input className={inputCls} placeholder="e.g. John 3:16" value={newDraft.scripture ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, scripture: e.target.value }))} /></Field>
            <Field label="Audio URL"><input className={inputCls} placeholder="/api/static/..." value={newDraft.audioUrl ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, audioUrl: e.target.value }))} /></Field>
            <Field label="Duration (min)"><input className={inputCls} type="number" value={newDraft.durationMinutes ?? ""} onChange={(e) => setNewDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))} /></Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createLecture} disabled={createSaving || !newDraft.title?.trim() || !newDraft.content?.trim()} className="px-4 py-2 bg-[#1A1F36] text-white rounded-xl text-[13px] font-semibold disabled:opacity-40">
              {createSaving ? "Creating…" : "Create"}
            </button>
            <button onClick={() => { setCreating(false); setNewDraft({}); }} className="px-4 py-2 bg-[#E8E4DC] text-[#1A1F36] rounded-xl text-[13px]">Cancel</button>
          </div>
        </div>
      )}

      <LibraryContentFiltersCard
        search={listSearch}
        onSearchChange={setListSearch}
        slotFilter={slotFilter}
        onSlotFilterChange={setSlotFilter}
        audioFilter={audioFilter}
        onAudioFilterChange={setAudioFilter}
        showingCount={filteredLectures.length}
        totalCount={lectures.length}
        slotFilterVisible={false}
      />

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3">
          {!loading && lectures.length > 0 && filteredLectures.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No lectures match these filters — try a different search or audio filter
            </div>
          )}
          {filteredLectures.map((l) => (
            <div key={l.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              {editId === l.id ? (
                <div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Title"><input className={inputCls} value={draft.title ?? ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></Field>
                    <Field label="Subtitle"><input className={inputCls} value={draft.subtitle ?? ""} onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} /></Field>
                  </div>
                  <Field label="Content" className="mt-3"><textarea className={`${inputCls} resize-none`} rows={5} value={draft.content ?? ""} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} /></Field>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Scripture"><input className={inputCls} value={draft.scripture ?? ""} onChange={(e) => setDraft((d) => ({ ...d, scripture: e.target.value }))} /></Field>
                    <Field label="Audio URL"><input className={inputCls} value={draft.audioUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, audioUrl: e.target.value }))} /></Field>
                    <Field label="Duration (min)"><input className={inputCls} type="number" value={draft.durationMinutes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))} /></Field>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#1A1F36] text-white rounded-xl text-[13px] font-semibold disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 bg-[#E8E4DC] text-[#1A1F36] rounded-xl text-[13px]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {l.audioUrl && <span className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">🎧 Audio</span>}
                      {l.durationMinutes && <span className="text-[11px] text-[#8A8FA8]">{l.durationMinutes} min</span>}
                    </div>
                    <p className="text-sm font-semibold text-[#1A1F36]">{l.title}</p>
                    {l.subtitle && <p className="text-[12px] text-[#8A8FA8] mt-0.5">{l.subtitle}</p>}
                    <p className="text-[13px] text-[#5B6280] mt-1.5 line-clamp-2 leading-relaxed">{l.content}</p>
                    {l.scripture && <p className="text-[11px] text-[#D4A043] mt-1">📜 {l.scripture}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(l)} className="px-3 py-1.5 text-[12px] border border-[#E8E4DC] rounded-lg hover:border-[#F97316] transition-colors font-medium">Edit</button>
                    <button onClick={() => void handleDelete(l.id)} className="px-3 py-1.5 text-[12px] text-[#EF4444] border border-[#EF4444]/40 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {lectures.length === 0 && (
            <div className="py-16 text-center text-[13px] text-[var(--color-muted)]">No lectures loaded yet</div>
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
