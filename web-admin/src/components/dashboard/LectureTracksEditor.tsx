"use client";

import { ChevronDown, ChevronUp, GripVertical, Headphones, Plus, Trash2 } from "lucide-react";
import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { inputCls } from "@/components/dashboard/form-styles";
import { cn } from "@/lib/cn";

export type LectureTrackDraft = {
  clientKey: string;
  id?: number;
  title: string;
  description: string;
  audioUrl: string;
};

export function emptyTrackDraft(title = ""): LectureTrackDraft {
  return {
    clientKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description: "",
    audioUrl: "",
  };
}

export function tracksFromApi(
  tracks: { id: number; title: string; description?: string | null; audioUrl: string }[] | undefined,
): LectureTrackDraft[] {
  if (!tracks?.length) return [emptyTrackDraft("Part 1")];
  return tracks.map((t, i) => ({
    clientKey: `id-${t.id}`,
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    audioUrl: t.audioUrl,
  }));
}

export function tracksToPayload(tracks: LectureTrackDraft[]) {
  return tracks
    .filter((t) => t.title.trim() && t.audioUrl.trim())
    .map((t, index) => ({
      ...(t.id ? { id: t.id } : {}),
      title: t.title.trim(),
      description: t.description.trim() || null,
      audioUrl: t.audioUrl.trim(),
      orderIndex: index,
    }));
}

export function validateTrackDrafts(tracks: LectureTrackDraft[]): string | null {
  const payload = tracksToPayload(tracks);
  if (payload.length === 0) return "Add at least one audio part with a title and uploaded file.";
  return null;
}

export function LectureTracksEditor({
  tracks,
  onChange,
  token,
  disabled,
  className,
}: {
  tracks: LectureTrackDraft[];
  onChange: (tracks: LectureTrackDraft[]) => void;
  token: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= tracks.length) return;
    const copy = [...tracks];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item!);
    onChange(copy);
  };

  const update = (index: number, patch: Partial<LectureTrackDraft>) => {
    onChange(tracks.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const remove = (index: number) => {
    if (tracks.length <= 1) {
      onChange([emptyTrackDraft(`Part ${index + 1}`)]);
      return;
    }
    onChange(tracks.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-cream/30 p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Audio series</p>
            <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-muted">
              Each part becomes its own card in the app. Listeners tap a part to play it, and can auto-advance through the series.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...tracks, emptyTrackDraft(`Part ${tracks.length + 1}`)])}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#252c4a] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add part
        </button>
      </div>

      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={track.clientKey}
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-cream/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted" aria-hidden />
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-[13px] font-semibold text-primary">
                  {track.title.trim() || `Part ${index + 1}`}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-md p-1.5 text-muted hover:bg-white disabled:opacity-30"
                  aria-label="Move part up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === tracks.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-md p-1.5 text-muted hover:bg-white disabled:opacity-30"
                  aria-label="Move part down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="rounded-md p-1.5 text-[#EF4444] hover:bg-red-50 disabled:opacity-30"
                  aria-label="Remove part"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <Field label="Part title *">
                <input
                  className={inputCls}
                  placeholder={`Part ${index + 1} — Introduction`}
                  value={track.title}
                  disabled={disabled}
                  onChange={(e) => update(index, { title: e.target.value })}
                />
              </Field>
              <Field label="Part description" className="sm:col-span-2">
                <textarea
                  className={`${inputCls} resize-none`}
                  placeholder="Optional — shown under the part title in the app"
                  rows={2}
                  value={track.description}
                  disabled={disabled}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </Field>
              <AdminAudioField
                className="sm:col-span-2"
                label="Audio file *"
                token={token}
                disabled={disabled}
                value={track.audioUrl}
                onChange={(audioUrl) => update(index, { audioUrl })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}
