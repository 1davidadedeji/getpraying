"use client";

import { AdminAudioField } from "@/components/dashboard/AdminAudioField";
import { FormField } from "@/components/dashboard/FormField";
import { ScriptureField } from "@/components/dashboard/ScriptureField";
import { inputCls } from "@/components/dashboard/form-styles";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { formatDisplayDate, formatLocalYMD, isValidYMD, normalizeScheduledDate } from "@/lib/date";

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

  const scheduledDate = normalizeScheduledDate(draft.scheduledDate);
  const dateValid = isValidYMD(scheduledDate);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)]/40 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Schedule
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showSlot !== false ? (
            <AdminSelect
              label="Slot *"
              value={draft.scheduleSlot}
              onChange={(v) => set({ scheduleSlot: v === "evening" ? "evening" : "morning" })}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </AdminSelect>
          ) : null}
          <FormField label="Go-live date *" className={showSlot === false ? "sm:col-span-2" : undefined}>
            <input
              className={inputCls}
              type="date"
              name="scheduledDate"
              required
              value={scheduledDate}
              disabled={disabled}
              onChange={(e) => set({ scheduledDate: e.target.value })}
            />
            {dateValid ? (
              <p className="mt-1 text-[11px] font-medium text-[var(--color-primary)]">
                {formatDisplayDate(scheduledDate)}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--color-danger)]">Use format YYYY-MM-DD.</p>
            )}
          </FormField>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-muted)]">
          Pick the calendar day this guide should appear in the app. Future dates are allowed — until then, users still
          see the most recent prior schedule for that slot.
        </p>
      </div>
      <FormField label="Title *">
        <input
          className={inputCls}
          placeholder="Title"
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
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
      <ScriptureField
        className="sm:col-span-2"
        value={draft.scripture}
        disabled={disabled}
        placeholder="Optional, e.g. Psalm 23:1"
        onChange={(scripture) => set({ scripture })}
      />
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

export function ScheduledDateBadge({ scheduledDate }: { scheduledDate: string | null | undefined }) {
  const ymd = scheduledDate ? normalizeScheduledDate(scheduledDate) : null;
  if (!ymd || !isValidYMD(ymd)) {
    return (
      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">No date set</span>
    );
  }

  const today = formatLocalYMD();
  const tone =
    ymd > today
      ? "bg-sky-50 text-sky-800"
      : ymd < today
        ? "bg-slate-100 text-slate-600"
        : "bg-emerald-50 text-emerald-800";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`} title={ymd}>
      {ymd === today ? "Today" : formatDisplayDate(ymd)}
    </span>
  );
}
