"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  SanctuaryGuideForm,
  type SanctuaryGuideDraft,
} from "@/components/dashboard/SanctuaryGuideForm";
import { panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";
import { formatLocalYMD, isValidYMD, normalizeScheduledDate } from "@/lib/date";
import { fetchOfficialGuide } from "@/lib/fetchOfficialGuide";
import { scriptureForApi, contentForApi } from "@/lib/officialGuidePayload";

export default function EditOfficialPrayerPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const id = Number(params.id);
  const [draft, setDraft] = useState<SanctuaryGuideDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(id)) return;
    setLoading(true);
    try {
      const row = await fetchOfficialGuide(token, id);
      if (!row) {
        setError("Guide not found");
        return;
      }
      setDraft({
        title: row.title ?? "",
        subtitle: row.subtitle ?? "",
        content: row.content ?? "",
        scripture: row.scripture ?? "",
        audioUrl: row.audioUrl ?? "",
        durationMinutes: row.durationMinutes ?? undefined,
        scheduleSlot: row.scheduleSlot === "evening" ? "evening" : "morning",
        scheduledDate: normalizeScheduledDate(row.scheduledDate, formatLocalYMD()),
      });
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !draft) return;
    const scheduledDate = normalizeScheduledDate(draft.scheduledDate);
    if (!isValidYMD(scheduledDate)) {
      setError("Go-live date must be YYYY-MM-DD.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/official-prayers/${id}`, token, { method: "PUT", body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          content: contentForApi(draft.content, draft.subtitle, draft.title),
          scripture: scriptureForApi(draft.scripture),
          audioUrl: draft.audioUrl.trim() || null,
          durationMinutes: draft.durationMinutes,
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

  if (loading) return <Spinner />;

  if (!draft) {
    return (
      <>
        <PageHeader title="Guide not found" backHref="/dashboard/official-prayers" backLabel="Official guides" />
        <p className="text-[12px] text-[var(--color-muted)]">{error ?? "This guide may have been removed."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit guide" backHref="/dashboard/official-prayers" backLabel="Official guides" />
      <div className={`${panelCls} p-3 sm:p-4`}>
        <SanctuaryGuideForm draft={draft} onChange={setDraft} token={token} disabled={saving} />
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Save"
          primaryLoading={saving}
          primaryDisabled={!draft.title.trim() || !isValidYMD(normalizeScheduledDate(draft.scheduledDate))}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/official-prayers")}
        />
      </div>
    </>
  );
}
