"use client";

import { FormField } from "@/components/dashboard/FormField";
import { ScriptureField } from "@/components/dashboard/ScriptureField";
import { inputCls } from "@/components/dashboard/form-styles";
import type { LectureTrackDraft } from "@/components/dashboard/LectureTracksEditor";

export type LectureFormDraft = {
  title: string;
  subtitle: string;
  content: string;
  scripture: string;
  durationMinutes?: number;
  tracks: LectureTrackDraft[];
};

export function LectureLessonFields({
  draft,
  onChange,
  disabled,
}: {
  draft: Pick<LectureFormDraft, "title" | "subtitle" | "content" | "scripture" | "durationMinutes">;
  onChange: (patch: Partial<LectureFormDraft>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Title *">
        <input
          className={inputCls}
          placeholder="Lesson title"
          value={draft.title ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </FormField>
      <FormField label="Subtitle">
        <input
          className={inputCls}
          placeholder="Optional"
          value={draft.subtitle ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </FormField>
      <FormField label="Description (optional)" className="sm:col-span-2">
        <textarea
          className={`${inputCls} resize-none`}
          placeholder="Optional — lesson overview shown in the app"
          rows={4}
          value={draft.content ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </FormField>
      <ScriptureField
        className="sm:col-span-2"
        value={draft.scripture ?? ""}
        disabled={disabled}
        placeholder="Optional, e.g. John 15:5"
        onChange={(scripture) => onChange({ scripture })}
      />
      <FormField label="Duration (min)">
        <input
          className={inputCls}
          type="number"
          value={draft.durationMinutes ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ durationMinutes: Number(e.target.value) || undefined })}
        />
      </FormField>
    </div>
  );
}
