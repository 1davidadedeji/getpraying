"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { inputCls } from "@/components/dashboard/form-styles";
import { cn } from "@/lib/cn";
import { uploadAdminAudio } from "@/lib/uploadAudio";

export function AdminAudioField({
  label = "Audio",
  value,
  onChange,
  token,
  disabled,
  className,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  token: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !token) return;
      setError(null);
      setUploading(true);
      try {
        const url = await uploadAdminAudio(token, file);
        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [token, onChange],
  );

  const busy = disabled || uploading;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mb-1.5 text-[11px] text-muted">
        Paste a URL or upload a file (MP3, M4A, WAV, etc.).
      </p>
      <input
        type="text"
        className={cn(inputCls, "mb-2")}
        placeholder="/api/static/uploads/… or https://…"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac,.caf,.3gp,.amr,.wma"
          className="hidden"
          disabled={busy || !token}
          onChange={(e) => void onPickFile(e)}
        />
        <button
          type="button"
          disabled={busy || !token}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-primary shadow-[inset_0_1px_0_color-mix(in_srgb,white_70%,transparent)] transition-colors hover:border-flame/30 disabled:pointer-events-none disabled:opacity-45"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {uploading ? "Uploading…" : "Upload audio file"}
        </button>
        {!token ? <span className="text-[11px] text-muted">Sign in to upload.</span> : null}
      </div>
      {error ? <p className="mt-1.5 text-[11px] font-medium text-danger">{error}</p> : null}
    </div>
  );
}
