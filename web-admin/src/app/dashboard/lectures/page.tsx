"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LibraryContentFiltersCard } from "@/components/dashboard/LibraryContentFiltersCard";
import { LectureSeriesPreview } from "@/components/dashboard/LectureSeriesPreview";
import {
  LectureTracksEditor,
  emptyTrackDraft,
  tracksFromApi,
  tracksToPayload,
  validateTrackDrafts,
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

async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export default function LecturesPage() {
  const { token } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LectureFormDraft>({ tracks: [emptyTrackDraft("Part 1")] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<LectureFormDraft>({
    tracks: [emptyTrackDraft("Part 1")],
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    setSaveError(null);
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
    const trackErr = validateTrackDrafts(draft.tracks);
    if (trackErr) {
      setSaveError(trackErr);
      return;
    }
    const tracksPayload = tracksToPayload(draft.tracks);
    setSaving(true);
    setSaveError(null);
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
          tracks: tracksPayload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.prayer ?? data;
        setLectures((prev) =>
          prev.map((x) =>
            x.id === editId
              ? { ...x, ...updated, tracks: data.tracks ?? updated.tracks ?? tracksPayload }
              : x,
          ),
        );
        setEditId(null);
      } else {
        setSaveError(await readApiError(res));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this lecture and all of its audio parts?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), { method: "DELETE", headers: authHeaders(token) });
    setLectures((prev) => prev.filter((x) => x.id !== id));
  };

  const createLecture = async () => {
    if (!token || !newDraft.title?.trim() || !newDraft.content?.trim()) return;
    const trackErr = validateTrackDrafts(newDraft.tracks);
    if (trackErr) {
      setCreateError(trackErr);
      return;
    }
    const tracksPayload = tracksToPayload(newDraft.tracks);
    setCreateSaving(true);
    setCreateError(null);
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
          tracks: tracksPayload,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        setLectures((prev) => [...prev, row]);
        setCreating(false);
        setNewDraft({ tracks: [emptyTrackDraft("Part 1")] });
      } else {
        setCreateError(await readApiError(res));
      }
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Lectures"
        description="Create a lesson card for the Library, then attach a series of audio parts listeners play one by one in the app."
        action={
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setCreateError(null);
              setNewDraft({ tracks: [emptyTrackDraft("Part 1")] });
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#252c4a]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New lesson
          </button>
        }
      />

      {creating && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-flame)_40%,var(--color-border))] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-cream)]/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                <BookOpen className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary)]">New lesson</p>
                <p className="text-[12px] text-[var(--color-muted)]">Lesson details + audio series</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <LessonFields draft={newDraft} onChange={setNewDraft} />
            <LectureTracksEditor
              token={token}
              disabled={createSaving}
              tracks={newDraft.tracks}
              onChange={(tracks) => setNewDraft((d) => ({ ...d, tracks }))}
            />
            {createError ? <p className="text-[13px] text-[#EF4444]">{createError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void createLecture()}
                disabled={createSaving || !newDraft.title?.trim() || !newDraft.content?.trim()}
                className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {createSaving ? "Creating…" : "Create lesson"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setCreateError(null);
                  setNewDraft({ tracks: [emptyTrackDraft("Part 1")] });
                }}
                className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
              >
                Cancel
              </button>
            </div>
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
        <div className="flex flex-col gap-4">
          {!loading && lectures.length > 0 && filteredLectures.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No lectures match these filters — try a different search or audio filter
            </div>
          )}
          {filteredLectures.map((l) => (
            <div
              key={l.id}
              className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
            >
              {editId === l.id ? (
                <div className="space-y-5 p-5">
                  <LessonFields draft={draft} onChange={setDraft} />
                  <LectureTracksEditor
                    token={token}
                    disabled={saving}
                    tracks={draft.tracks}
                    onChange={(tracks) => setDraft((d) => ({ ...d, tracks }))}
                  />
                  {saveError ? <p className="text-[13px] text-[#EF4444]">{saveError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void save()}
                      disabled={saving}
                      className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save lesson"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(null);
                        setSaveError(null);
                      }}
                      className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                          Lesson
                        </span>
                        {hasAudio(l) ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            {l.tracks!.length} audio {l.tracks!.length === 1 ? "part" : "parts"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Needs audio
                          </span>
                        )}
                        {l.durationMinutes ? (
                          <span className="text-[11px] text-[#8A8FA8]">{l.durationMinutes} min total</span>
                        ) : null}
                      </div>
                      <p className="text-base font-semibold text-[#1A1F36]">{l.title}</p>
                      {l.subtitle && <p className="mt-0.5 text-[13px] text-[#8A8FA8]">{l.subtitle}</p>}
                      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#5B6280]">{l.content}</p>
                      {l.scripture && <p className="mt-1.5 text-[12px] font-medium text-[#D4A043]">{l.scripture}</p>}
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
                  <LectureSeriesPreview tracks={l.tracks ?? []} />
                </div>
              )}
            </div>
          ))}
          {lectures.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)] py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted)]" aria-hidden />
              <p className="text-[14px] font-semibold text-[var(--color-primary)]">No lessons yet</p>
              <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                Create a lesson, then add the audio parts listeners will play in the app.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LessonFields({
  draft,
  onChange,
}: {
  draft: LectureFormDraft;
  onChange: React.Dispatch<React.SetStateAction<LectureFormDraft>>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <p className="mb-3 text-sm font-semibold text-[var(--color-primary)]">Lesson details</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title *">
          <input
            className={inputCls}
            placeholder="Lesson title shown on the Library card"
            value={draft.title ?? ""}
            onChange={(e) => onChange((d) => ({ ...d, title: e.target.value }))}
          />
        </Field>
        <Field label="Subtitle">
          <input
            className={inputCls}
            placeholder="Short tagline (optional)"
            value={draft.subtitle ?? ""}
            onChange={(e) => onChange((d) => ({ ...d, subtitle: e.target.value }))}
          />
        </Field>
        <Field label="Description *" className="sm:col-span-2">
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            placeholder="Overview shown when listeners open the lesson"
            value={draft.content ?? ""}
            onChange={(e) => onChange((d) => ({ ...d, content: e.target.value }))}
          />
        </Field>
        <Field label="Scripture" className="sm:col-span-2">
          <input
            className={inputCls}
            placeholder="e.g. John 15:5"
            value={draft.scripture ?? ""}
            onChange={(e) => onChange((d) => ({ ...d, scripture: e.target.value }))}
          />
        </Field>
        <Field label="Duration (min)">
          <input
            className={inputCls}
            type="number"
            placeholder="Optional total length"
            value={draft.durationMinutes ?? ""}
            onChange={(e) =>
              onChange((d) => ({ ...d, durationMinutes: Number(e.target.value) || undefined }))
            }
          />
        </Field>
      </div>
    </div>
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
