"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderTree, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { inputCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { categoryLabel, PATH_CATEGORY_OPTIONS } from "@/config/post-categories";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type PathSummary = {
  id: number;
  name: string;
  description: string;
  category: string;
  tagline: string | null;
  prayerCount: number;
};

type PathGuide = {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  scripture: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
  label: string | null;
  category: string;
  pathId: number | null;
};

type GuideDraft = {
  title: string;
  subtitle: string;
  content: string;
  scripture: string;
  audioUrl: string;
  durationMinutes?: number;
};

type NewPathDraft = {
  name: string;
  description: string;
  category: string;
  tagline: string;
};

const EMPTY_GUIDE: GuideDraft = {
  title: "",
  subtitle: "",
  content: "",
  scripture: "",
  audioUrl: "",
};

const EMPTY_PATH: NewPathDraft = {
  name: "",
  description: "",
  category: "anxiety",
  tagline: "",
};

async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export default function CategoryPathsPage() {
  const { token } = useAuth();
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [guides, setGuides] = useState<PathGuide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [pathSearch, setPathSearch] = useState("");
  const debouncedPathSearch = useDebouncedValue(pathSearch, 280);

  const [creatingGuide, setCreatingGuide] = useState(false);
  const [guideDraft, setGuideDraft] = useState<GuideDraft>(EMPTY_GUIDE);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  const [editGuideId, setEditGuideId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GuideDraft>(EMPTY_GUIDE);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [creatingPath, setCreatingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState<NewPathDraft>(EMPTY_PATH);
  const [pathSaving, setPathSaving] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  const selectedPath = useMemo(
    () => paths.find((p) => p.id === selectedPathId) ?? null,
    [paths, selectedPathId],
  );

  const filteredPaths = useMemo(() => {
    const q = debouncedPathSearch.trim().toLowerCase();
    if (!q) return paths;
    return paths.filter((p) => {
      const hay = `${p.name}\n${p.description}\n${p.category}\n${p.tagline ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [paths, debouncedPathSearch]);

  const loadPaths = useCallback(async () => {
    if (!token) return;
    setLoadingPaths(true);
    try {
      const res = await fetch(apiUrl("/library/paths"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const rows: PathSummary[] = (data.paths ?? []).map((p: PathSummary) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        tagline: p.tagline ?? null,
        prayerCount: p.prayerCount ?? 0,
      }));
      setPaths(rows);
      setSelectedPathId((prev) => {
        if (prev != null && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } finally {
      setLoadingPaths(false);
    }
  }, [token]);

  const loadGuides = useCallback(async () => {
    if (!token || selectedPathId == null) {
      setGuides([]);
      return;
    }
    setLoadingGuides(true);
    try {
      const res = await fetch(apiUrl(`/library/paths/${selectedPathId}`), {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setGuides([]);
        return;
      }
      const data = await res.json();
      setGuides(data.officialPrayers ?? []);
    } finally {
      setLoadingGuides(false);
    }
  }, [token, selectedPathId]);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  useEffect(() => {
    void loadGuides();
  }, [loadGuides]);

  const refreshPathCounts = useCallback(async () => {
    await loadPaths();
    await loadGuides();
  }, [loadPaths, loadGuides]);

  const createGuide = async () => {
    if (!token || !selectedPath) return;
    if (!guideDraft.title.trim()) {
      setGuideError("Title is required.");
      return;
    }
    if (!guideDraft.audioUrl.trim()) {
      setGuideError("Upload an audio file for this guide.");
      return;
    }
    setGuideSaving(true);
    setGuideError(null);
    try {
      const content =
        guideDraft.content.trim() ||
        guideDraft.subtitle.trim() ||
        guideDraft.title.trim();
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: guideDraft.title.trim(),
          subtitle: guideDraft.subtitle.trim() || null,
          content,
          scripture: guideDraft.scripture.trim() || null,
          audioUrl: guideDraft.audioUrl.trim(),
          durationMinutes: guideDraft.durationMinutes,
          category: selectedPath.category,
          pathId: selectedPath.id,
          label: "Official Prayer",
        }),
      });
      if (res.ok) {
        setCreatingGuide(false);
        setGuideDraft(EMPTY_GUIDE);
        await refreshPathCounts();
      } else {
        setGuideError(await readApiError(res));
      }
    } finally {
      setGuideSaving(false);
    }
  };

  const startEditGuide = (g: PathGuide) => {
    setEditGuideId(g.id);
    setEditError(null);
    setEditDraft({
      title: g.title,
      subtitle: g.subtitle ?? "",
      content: g.content,
      scripture: g.scripture ?? "",
      audioUrl: g.audioUrl ?? "",
      durationMinutes: g.durationMinutes ?? undefined,
    });
  };

  const saveGuide = async () => {
    if (!token || editGuideId == null || !selectedPath) return;
    if (!editDraft.title.trim()) {
      setEditError("Title is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${editGuideId}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: editDraft.title.trim(),
          subtitle: editDraft.subtitle.trim() || null,
          content:
            editDraft.content.trim() ||
            editDraft.subtitle.trim() ||
            editDraft.title.trim(),
          scripture: editDraft.scripture.trim() || null,
          audioUrl: editDraft.audioUrl.trim() || null,
          durationMinutes: editDraft.durationMinutes,
          category: selectedPath.category,
          pathId: selectedPath.id,
          label: "Official Prayer",
        }),
      });
      if (res.ok) {
        setEditGuideId(null);
        await refreshPathCounts();
      } else {
        setEditError(await readApiError(res));
      }
    } finally {
      setEditSaving(false);
    }
  };

  const deleteGuide = async (id: number) => {
    if (!token || !confirm("Delete this guide from the path?")) return;
    await fetch(apiUrl(`/admin/official-prayers/${id}`), {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (editGuideId === id) setEditGuideId(null);
    await refreshPathCounts();
  };

  const createPath = async () => {
    if (!token || !pathDraft.name.trim() || !pathDraft.description.trim()) return;
    setPathSaving(true);
    setPathError(null);
    try {
      const res = await fetch(apiUrl("/admin/prayer-paths"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: pathDraft.name.trim(),
          description: pathDraft.description.trim(),
          category: pathDraft.category,
          tagline: pathDraft.tagline.trim() || null,
        }),
      });
      if (res.ok) {
        const row = (await res.json()) as PathSummary;
        setCreatingPath(false);
        setPathDraft(EMPTY_PATH);
        await loadPaths();
        setSelectedPathId(row.id);
      } else {
        setPathError(await readApiError(res));
      }
    } finally {
      setPathSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Category guides"
        description="Official audio for Library paths — anxiety, family, forgiveness, and the rest of the Explore grid."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCreatingPath(true);
                setPathError(null);
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[#F97316]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New path
            </button>
            <button
              type="button"
              disabled={!selectedPath}
              onClick={() => {
                setCreatingGuide(true);
                setGuideError(null);
                setGuideDraft(EMPTY_GUIDE);
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#252c4a] disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add guide
            </button>
          </div>
        }
      />

      {creatingPath ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-cream)]/60 px-5 py-4">
            <p className="text-sm font-semibold text-[var(--color-primary)]">New library path</p>
            <p className="text-[12px] text-[var(--color-muted)]">
              Creates a tile under Explore in the mobile Library tab.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Display name *">
              <input
                className={inputCls}
                placeholder="Anxiety"
                value={pathDraft.name}
                onChange={(e) => setPathDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
            <AdminSelect
              label="Category slug *"
              value={pathDraft.category}
              onChange={(v) => setPathDraft((d) => ({ ...d, category: v }))}
            >
              {PATH_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </AdminSelect>
            <Field label="Tagline" className="sm:col-span-2">
              <input
                className={inputCls}
                placeholder="Short line on the path card (optional)"
                value={pathDraft.tagline}
                onChange={(e) => setPathDraft((d) => ({ ...d, tagline: e.target.value }))}
              />
            </Field>
            <Field label="Description *" className="sm:col-span-2">
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="What this path is for"
                value={pathDraft.description}
                onChange={(e) => setPathDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </Field>
          </div>
          {pathError ? <p className="px-5 pb-2 text-[13px] text-[#EF4444]">{pathError}</p> : null}
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <button
              onClick={() => void createPath()}
              disabled={pathSaving || !pathDraft.name.trim() || !pathDraft.description.trim()}
              className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {pathSaving ? "Creating…" : "Create path"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingPath(false);
                setPathError(null);
              }}
              className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loadingPaths ? (
        <Spinner />
      ) : paths.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)] py-16 text-center">
          <FolderTree className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted)]" aria-hidden />
          <p className="text-[14px] font-semibold text-[var(--color-primary)]">No paths yet</p>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Create a path or run the library seed script on the server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(240px,300px)_1fr]">
          <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Library paths
            </p>
            <input
              className={`${inputCls} mb-3`}
              placeholder="Search paths…"
              value={pathSearch}
              onChange={(e) => setPathSearch(e.target.value)}
            />
            <div className="flex max-h-[min(520px,60vh)] flex-col gap-1.5 overflow-y-auto">
              {filteredPaths.map((p) => {
                const active = p.id === selectedPathId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPathId(p.id);
                      setCreatingGuide(false);
                      setEditGuideId(null);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                        : "border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-cream)]/50"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[var(--color-primary)]">{p.name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                      {categoryLabel(p.category)} · {p.prayerCount} guide{p.prayerCount === 1 ? "" : "s"}
                    </p>
                  </button>
                );
              })}
              {filteredPaths.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[var(--color-muted)]">No paths match search</p>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0">
            {selectedPath ? (
              <>
                <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                      {categoryLabel(selectedPath.category)}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {selectedPath.prayerCount} guide{selectedPath.prayerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#1A1F36]">{selectedPath.name}</h2>
                  {selectedPath.tagline ? (
                    <p className="mt-1 text-[13px] font-medium text-[#D4A043]">{selectedPath.tagline}</p>
                  ) : null}
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5B6280]">{selectedPath.description}</p>
                </div>

                {creatingGuide ? (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-flame)_35%,var(--color-border))] bg-[var(--color-surface)] shadow-sm">
                    <div className="border-b border-[var(--color-border)] bg-[var(--color-cream)]/50 px-5 py-3">
                      <p className="text-[13px] font-semibold text-[var(--color-primary)]">
                        New guide for {selectedPath.name}
                      </p>
                    </div>
                    <GuideForm
                      draft={guideDraft}
                      onChange={setGuideDraft}
                      token={token}
                      disabled={guideSaving}
                    />
                    {guideError ? <p className="px-5 text-[13px] text-[#EF4444]">{guideError}</p> : null}
                    <div className="flex flex-wrap gap-2 px-5 pb-5 pt-2">
                      <button
                        onClick={() => void createGuide()}
                        disabled={guideSaving || !guideDraft.title.trim()}
                        className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                      >
                        {guideSaving ? "Publishing…" : "Publish guide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingGuide(false);
                          setGuideError(null);
                        }}
                        className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {loadingGuides ? (
                  <Spinner />
                ) : guides.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/40 px-4 py-12 text-center">
                    <p className="text-[13px] font-semibold text-[var(--color-primary)]">No guides on this path</p>
                    <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                      Add an official prayer with audio — it appears when members open this category in the app.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {guides.map((g) =>
                      editGuideId === g.id ? (
                        <div
                          key={g.id}
                          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
                        >
                          <p className="mb-3 text-[13px] font-semibold text-[var(--color-primary)]">Edit guide</p>
                          <GuideForm
                            draft={editDraft}
                            onChange={setEditDraft}
                            token={token}
                            disabled={editSaving}
                          />
                          {editError ? <p className="mt-2 text-[13px] text-[#EF4444]">{editError}</p> : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => void saveGuide()}
                              disabled={editSaving}
                              className="rounded-xl bg-[#1A1F36] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                            >
                              {editSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGuideId(null);
                                setEditError(null);
                              }}
                              className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-[13px] text-[#1A1F36]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={g.id}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              {g.audioUrl ? (
                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                  Audio
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  No audio
                                </span>
                              )}
                              {g.durationMinutes ? (
                                <span className="text-[11px] text-[#8A8FA8]">{g.durationMinutes} min</span>
                              ) : null}
                            </div>
                            <p className="text-sm font-semibold text-[#1A1F36]">{g.title}</p>
                            {g.subtitle ? (
                              <p className="mt-0.5 text-[12px] text-[#8A8FA8]">{g.subtitle}</p>
                            ) : null}
                            {g.scripture ? (
                              <p className="mt-1 text-[11px] text-[#D4A043]">{g.scripture}</p>
                            ) : null}
                            {g.content ? (
                              <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[#5B6280]">
                                {g.content}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEditGuide(g)}
                              className="rounded-lg border border-[#E8E4DC] px-3 py-1.5 text-[12px] font-medium hover:border-[#F97316]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteGuide(g.id)}
                              className="rounded-lg border border-[#EF4444]/40 px-3 py-1.5 text-[12px] text-[#EF4444] hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[var(--color-muted)]">Select a path from the list.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function GuideForm({
  draft,
  onChange,
  token,
  disabled,
}: {
  draft: GuideDraft;
  onChange: (d: GuideDraft) => void;
  token: string | null;
  disabled?: boolean;
}) {
  const set = (patch: Partial<GuideDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <Field label="Title *">
        <input
          className={inputCls}
          placeholder="Guide title"
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field label="Duration (min)">
        <input
          className={inputCls}
          type="number"
          value={draft.durationMinutes ?? ""}
          disabled={disabled}
          onChange={(e) => set({ durationMinutes: Number(e.target.value) || undefined })}
        />
      </Field>
      <Field label="Subtitle" className="sm:col-span-2">
        <input
          className={inputCls}
          placeholder="Optional short line"
          value={draft.subtitle}
          disabled={disabled}
          onChange={(e) => set({ subtitle: e.target.value })}
        />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Shown in the app on the guide card"
          value={draft.content}
          disabled={disabled}
          onChange={(e) => set({ content: e.target.value })}
        />
      </Field>
      <Field label="Scripture" className="sm:col-span-2">
        <input
          className={inputCls}
          placeholder="e.g. Philippians 4:6–7"
          value={draft.scripture}
          disabled={disabled}
          onChange={(e) => set({ scripture: e.target.value })}
        />
      </Field>
      <AdminAudioField
        className="sm:col-span-2"
        label="Audio *"
        token={token}
        disabled={disabled}
        value={draft.audioUrl}
        onChange={(audioUrl) => set({ audioUrl })}
      />
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
