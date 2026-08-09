"use client";

import { Headphones } from "lucide-react";

type Track = {
  id: number;
  title: string;
  description?: string | null;
  audioUrl: string;
  orderIndex?: number;
};

export function LectureSeriesPreview({ tracks }: { tracks: Track[] }) {
  if (!tracks.length) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border bg-cream/40 px-3 py-4 text-[12px] text-muted">
        No audio parts yet — edit this lesson to add the series.
      </div>
    );
  }

  const sorted = [...tracks].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id - b.id);

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Audio series · {sorted.length} {sorted.length === 1 ? "part" : "parts"}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sorted.map((track, index) => (
          <div
            key={track.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-primary">{track.title}</p>
              {track.description ? (
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                  {track.description}
                </p>
              ) : null}
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                <Headphones className="h-3 w-3" aria-hidden />
                Ready to play
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
