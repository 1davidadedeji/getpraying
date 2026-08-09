"use client";

import { resolveMediaUrl } from "@/lib/mediaUrl";
import { panelCls } from "@/components/dashboard/form-styles";

export function AdminPostMedia({
  mediaUrl,
  mediaType,
}: {
  mediaUrl: string | null | undefined;
  mediaType: string | null | undefined;
}) {
  const src = resolveMediaUrl(mediaUrl);
  if (!src) return null;

  const type = (mediaType ?? "").toLowerCase();

  if (type === "image") {
    return (
      <div className="mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Post attachment" className="max-h-72 max-w-full rounded border border-border object-contain" />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="max-h-72 max-w-full rounded border border-border bg-black"
        />
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className={`${panelCls} mt-2 p-2`}>
        <p className="mb-1 text-[10px] font-semibold uppercase text-muted">Audio</p>
        <audio src={src} controls preload="metadata" className="h-8 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-medium text-flame underline"
      >
        Open attachment ({type || "file"})
      </a>
    </div>
  );
}
