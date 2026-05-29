"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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
  if (!tracks?.length) return [emptyTrackDraft()];
  return tracks.map((t) => ({
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
      onChange([emptyTrackDraft()]);
      return;
    }
    onChange(tracks.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Audio tracks
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            Each track appears as a separate listen in the mobile app playlist.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...tracks, emptyTrackDraft()])}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-primary)] transition-colors hover:border-[#F97316] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add track
        </button>
      </div>

      {tracks.map((track, index) => (
        <div
          key={track.clientKey}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/40 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--color-primary)]">Track {index + 1}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30"
                aria-label="Move track up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled || index === tracks.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30"
                aria-label="Move track down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(index)}
                className="rounded-md p-1.5 text-[#EF4444] hover:bg-red-50 disabled:opacity-30"
                aria-label="Remove track"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Track title *">
              <input
                className={inputCls}
                placeholder="Part 1 — Introduction"
                value={track.title}
                disabled={disabled}
                onChange={(e) => update(index, { title: e.target.value })}
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                placeholder="Optional notes shown under the track title in the app"
                value={track.description}
                disabled={disabled}
                onChange={(e) => update(index, { description: e.target.value })}
              />
            </Field>
            <AdminAudioField
              className="sm:col-span-2"
              label="Track audio *"
              token={token}
              disabled={disabled}
              value={track.audioUrl}
              onChange={(audioUrl) => update(index, { audioUrl })}
            />
          </div>
        </div>
      ))}
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
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      {children}
    </div>
  );
}
