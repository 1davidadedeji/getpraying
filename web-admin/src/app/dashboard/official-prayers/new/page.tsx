"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  EMPTY_SANCTUARY_GUIDE,
  SanctuaryGuideForm,
  type SanctuaryGuideDraft,
} from "@/components/dashboard/SanctuaryGuideForm";
import { panelCls } from "@/components/dashboard/form-styles";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";
import { isValidYMD, normalizeScheduledDate } from "@/lib/date";

export default function NewOfficialPrayerPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [draft, setDraft] = useState<SanctuaryGuideDraft>(EMPTY_SANCTUARY_GUIDE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!token || !draft.title.trim()) return;
    const scheduledDate = normalizeScheduledDate(draft.scheduledDate);
    if (!isValidYMD(scheduledDate)) {
      setError("Go-live date must be YYYY-MM-DD.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          scripture: draft.scripture.trim() || null,
          audioUrl: draft.audioUrl.trim() || null,
          durationMinutes: draft.durationMinutes,
          category: "sanctuary",
          scheduleSlot: draft.scheduleSlot,
          scheduledDate,
          label: "Official Prayer",
        }),
      });
      if (res.ok) {
        router.push("/dashboard/official-prayers");
        return;
      }
      setError(await readApiError(res));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New sanctuary guide"
        backHref="/dashboard/official-prayers"
        backLabel="Official guides"
      />
      <div className={`${panelCls} p-3 sm:p-4`}>
        <SanctuaryGuideForm draft={draft} onChange={setDraft} token={token} disabled={saving} />
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Create"
          primaryLoading={saving}
          primaryDisabled={!draft.title.trim() || !isValidYMD(normalizeScheduledDate(draft.scheduledDate))}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/official-prayers")}
        />
      </div>
    </>
  );
}
