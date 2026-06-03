"use client";

import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { FormField } from "@/components/dashboard/FormField";
import { inputCls } from "@/components/dashboard/form-styles";

export type PathGuideDraft = {
  title: string;
  subtitle: string;
  content: string;
  scripture: string;
  audioUrl: string;
  durationMinutes?: number;
};

export const EMPTY_PATH_GUIDE: PathGuideDraft = {
  title: "",
  subtitle: "",
  content: "",
  scripture: "",
  audioUrl: "",
};

export function PathGuideForm({
  draft,
  onChange,
  token,
  disabled,
}: {
  draft: PathGuideDraft;
  onChange: (d: PathGuideDraft) => void;
  token: string | null;
  disabled?: boolean;
}) {
  const set = (patch: Partial<PathGuideDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Title *">
        <input
          className={inputCls}
          placeholder="Guide title"
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
        />
      </FormField>
      <FormField label="Duration (min)">
        <input
          className={inputCls}
          type="number"
          value={draft.durationMinutes ?? ""}
          disabled={disabled}
          onChange={(e) => set({ durationMinutes: Number(e.target.value) || undefined })}
        />
      </FormField>
      <FormField label="Subtitle" className="sm:col-span-2">
        <input
          className={inputCls}
          placeholder="Optional"
          value={draft.subtitle}
          disabled={disabled}
          onChange={(e) => set({ subtitle: e.target.value })}
        />
      </FormField>
      <FormField label="Scripture" className="sm:col-span-2">
        <input
          className={inputCls}
          placeholder="e.g. Philippians 4:6–7"
          value={draft.scripture}
          disabled={disabled}
          onChange={(e) => set({ scripture: e.target.value })}
        />
      </FormField>
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
