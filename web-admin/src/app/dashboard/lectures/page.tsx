"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import {
  LectureTracksEditor,
  emptyTrackDraft,
  tracksFromApi,
  tracksToPayload,
  type LectureTrackDraft,
} from "@/components/dashboard/LectureTracksEditor";
import { inputCls } from "@/components/dashboard/form-styles";
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
  createdAt: string;
  tracks?: LectureTrack[];
}

type LectureFormDraft = Partial<
  Pick<Lecture, "title" | "subtitle" | "content" | "scripture" | "durationMinutes">
> & {
  tracks: LectureTrackDraft[];
};

function hasAudio(l: Lecture): boolean {
  return (l.tracks?.length ?? 0) > 0;
}

export default function LecturesPage() {
  const { token } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LectureFormDraft>({ tracks: [emptyTrackDraft()] });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<LectureFormDraft>({
    tracks: [emptyTrackDraft()],
  });
  const [createSaving, setCreateSaving] = useState(false);

  const [listSearch, setListSearch] = useState("");
  const debouncedListSearch = useDebouncedValue(listSearch, 320);
  const [audioFilter, setAudioFilter] = useState<"all" | "yes" | "no">("all");

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

  const startEdit = (l: Lecture) => {
    setEditId(l.id);
    setDraft({
      title: l.title,
      subtitle: l.subtitle ?? "",
      content: l.content,
      scripture: l.scripture ?? "",
      durationMinutes: l.durationMinutes ?? undefined,
      tracks: tracksFromApi(l.tracks),
    });
  };

  const save = async () => {
    if (!token || editId === null) return;
    const tracksPayload = tracksToPayload(draft.tracks);
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${editId}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: draft.title,
          subtitle: draft.subtitle,
          content: draft.content,
          scripture: draft.scripture,
          durationMinutes: draft.durationMinutes,
          category: "lectures",
          pathId: null,
          ...(tracksPayload.length > 0 ? { tracks: tracksPayload } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.prayer ?? data;
        setLectures((prev) => prev.map((x) => (x.id === editId ? { ...x, ...updated } : x)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this lecture?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), { method: "DELETE", headers: authHeaders(token) });
    setLectures((prev) => prev.filter((x) => x.id !== id));
  };

  const createLecture = async () => {
    if (!token || !newDraft.title?.trim() || !newDraft.content?.trim()) return;
    const tracksPayload = tracksToPayload(newDraft.tracks);
    setCreateSaving(true);
    try {
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: newDraft.title,
          subtitle: newDraft.subtitle,
          content: newDraft.content,
          scripture: newDraft.scripture,
          durationMinutes: newDraft.durationMinutes,
          category: "lectures",
          tracks: tracksPayload.length > 0 ? tracksPayload : undefined,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        setLectures((prev) => [...prev, row]);
        setCreating(false);
        setNewDraft({ tracks: [emptyTrackDraft()] });
      }
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Lectures"
        description="Standalone listens for the Library carousel — each lecture can include multiple audio tracks."
        action={
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setNewDraft({ tracks: [emptyTrackDraft()] });
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
          <p className="mb-4 text-[13px] font-semibold text-[var(--color-primary)]">New lecture</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title *">
              <input
                className={inputCls}
                placeholder="Title"
                value={newDraft.title ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </Field>
            <Field label="Subtitle">
              <input
                className={inputCls}
                placeholder="Subtitle (optional)"
                value={newDraft.subtitle ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="Description *" className="sm:col-span-2">
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Shown in the app as detail text for this lecture"
                value={newDraft.content ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, content: e.target.value }))}
              />
            </Field>
            <Field label="Scripture" className="sm:col-span-2">
              <input
                className={inputCls}
                placeholder="e.g. John 3:16"
                value={newDraft.scripture ?? ""}
                onChange={(e) => setNewDraft((d) => ({ ...d, scripture: e.target.value }))}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                className={inputCls}
                type="number"
                value={newDraft.durationMinutes ?? ""}
                onChange={(e) =>
                  setNewDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))
                }
              />
            </Field>
            <LectureTracksEditor
              className="sm:col-span-2"
              token={token}
              disabled={createSaving}
              tracks={newDraft.tracks}
              onChange={(tracks) => setNewDraft((d) => ({ ...d, tracks }))}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => void createLecture()}
              disabled={createSaving || !newDraft.title?.trim() || !newDraft.content?.trim()}
              className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {createSaving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewDraft({ tracks: [emptyTrackDraft()] });
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
                    <Field label="Description" className="sm:col-span-2">
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={5}
                        value={draft.content ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                      />
                    </Field>
                    <Field label="Scripture" className="sm:col-span-2">
                      <input
                        className={inputCls}
                        value={draft.scripture ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, scripture: e.target.value }))}
                      />
                    </Field>
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
                    <LectureTracksEditor
                      className="sm:col-span-2"
                      token={token}
                      disabled={saving}
                      tracks={draft.tracks}
                      onChange={(tracks) => setDraft((d) => ({ ...d, tracks }))}
                    />
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
                      {hasAudio(l) && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
                          {l.tracks!.length} track{l.tracks!.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {l.durationMinutes ? (
                        <span className="text-[11px] text-[#8A8FA8]">{l.durationMinutes} min</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-[#1A1F36]">{l.title}</p>
                    {l.subtitle && <p className="mt-0.5 text-[12px] text-[#8A8FA8]">{l.subtitle}</p>}
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[#5B6280]">{l.content}</p>
                    {l.scripture && <p className="mt-1 text-[11px] text-[#D4A043]">{l.scripture}</p>}
                    {l.tracks && l.tracks.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[12px] text-[#5B6280]">
                        {l.tracks.map((t, i) => (
                          <li key={t.id}>
                            {i + 1}. {t.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(l)}
                      className="rounded-lg border border-[#E8E4DC] px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-[#F97316]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(l.id)}
                      className="rounded-lg border border-[#EF4444]/40 px-3 py-1.5 text-[12px] text-[#EF4444] transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
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
