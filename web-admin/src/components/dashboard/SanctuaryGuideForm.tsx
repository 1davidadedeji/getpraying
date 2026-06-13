"use client";

import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { FormField } from "@/components/dashboard/FormField";
import { inputCls } from "@/components/dashboard/form-styles";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { formatLocalYMD } from "@/lib/date";

export type SanctuaryGuideDraft = {
  title: string;
  subtitle: string;
  scripture: string;
  audioUrl: string;
  durationMinutes?: number;
  scheduleSlot: "morning" | "evening";
  scheduledDate: string;
};

export const EMPTY_SANCTUARY_GUIDE: SanctuaryGuideDraft = {
  title: "",
  subtitle: "",
  scripture: "",
  audioUrl: "",
  scheduleSlot: "morning",
  scheduledDate: formatLocalYMD(),
};

export function SanctuaryGuideForm({
  draft,
  onChange,
  token,
  disabled,
  showSlot,
}: {
  draft: SanctuaryGuideDraft;
  onChange: (d: SanctuaryGuideDraft) => void;
  token: string | null;
  disabled?: boolean;
  showSlot?: boolean;
}) {
  const set = (patch: Partial<SanctuaryGuideDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Title *">
        <input
          className={inputCls}
          placeholder="Title"
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
        />
      </FormField>
      {showSlot !== false ? (
        <AdminSelect
          label="Schedule slot *"
          value={draft.scheduleSlot}
          onChange={(v) => set({ scheduleSlot: v === "evening" ? "evening" : "morning" })}
        >
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </AdminSelect>
      ) : null}
      <FormField label="Scheduled date *" className={showSlot !== false ? "" : "sm:col-span-2"}>
        <input
          className={inputCls}
          type="date"
          value={draft.scheduledDate}
          disabled={disabled}
          onChange={(e) => set({ scheduledDate: e.target.value })}
        />
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          Content goes live on this calendar day. You can schedule future dates — until then, the app keeps showing
          the most recent prior schedule.
        </p>
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
      <FormField label="Scripture (optional)" className="sm:col-span-2">
        <input
          className={inputCls}
          placeholder="Optional, e.g. Psalm 23:1"
          value={draft.scripture}
          disabled={disabled}
          onChange={(e) => set({ scripture: e.target.value })}
        />
      </FormField>
      <AdminAudioField
        className="sm:col-span-2"
        token={token}
        disabled={disabled}
        value={draft.audioUrl}
        onChange={(audioUrl) => set({ audioUrl })}
      />
      <FormField label="Duration (min)">
        <input
          className={inputCls}
          type="number"
          value={draft.durationMinutes ?? ""}
          disabled={disabled}
          onChange={(e) => set({ durationMinutes: Number(e.target.value) || undefined })}
        />
      </FormField>
    </div>
  );
}

export function SlotBadge({ slot }: { slot: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        slot === "morning" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
      }`}
    >
      {slot === "morning" ? "Morning" : "Evening"}
    </span>
  );
}
