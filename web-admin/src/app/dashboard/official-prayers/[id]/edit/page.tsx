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
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";

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
      const res = await fetch(apiUrl("/library/official"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.prayers ?? data.items ?? [];
      const row = rows.find((p: { id: number }) => p.id === id);
      if (!row) {
        setError("Guide not found");
        return;
      }
      setDraft({
        title: row.title ?? "",
        subtitle: row.subtitle ?? "",
        scripture: row.scripture ?? "",
        audioUrl: row.audioUrl ?? "",
        durationMinutes: row.durationMinutes ?? undefined,
        scheduleSlot: row.scheduleSlot === "evening" ? "evening" : "morning",
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
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${id}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          scripture: draft.scripture.trim() || null,
          audioUrl: draft.audioUrl.trim() || null,
          durationMinutes: draft.durationMinutes,
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
        <SanctuaryGuideForm draft={draft} onChange={setDraft} token={token} disabled={saving} showSlot={false} />
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Save"
          primaryLoading={saving}
          primaryDisabled={!draft.title.trim()}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/official-prayers")}
        />
      </div>
    </>
  );
}
