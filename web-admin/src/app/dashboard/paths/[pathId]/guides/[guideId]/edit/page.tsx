"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PathGuideForm, type PathGuideDraft } from "@/components/dashboard/PathGuideForm";
import { btnDangerOutline, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";
import { scriptureForApi } from "@/lib/officialGuidePayload";

export default function EditPathGuidePage() {
  const params = useParams();
  const router = useRouter();
  const pathId = Number(params.pathId);
  const guideId = Number(params.guideId);
  const { token } = useAuth();
  const [pathName, setPathName] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<PathGuideDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(pathId) || !Number.isFinite(guideId)) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/library/paths/${pathId}`), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      setPathName(data.name ?? "Path");
      setCategory(data.category ?? "general");
      const guide = (data.officialPrayers ?? []).find((g: { id: number }) => g.id === guideId);
      if (!guide) {
        setDraft(null);
        return;
      }
      setDraft({
        title: guide.title,
        subtitle: guide.subtitle ?? "",
        content: guide.content,
        scripture: guide.scripture ?? "",
        audioUrl: guide.audioUrl ?? "",
        durationMinutes: guide.durationMinutes ?? undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [token, pathId, guideId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !draft) return;
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${guideId}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          content: draft.content.trim() || draft.subtitle.trim() || draft.title.trim(),
          scripture: scriptureForApi(draft.scripture),
          audioUrl: draft.audioUrl.trim() || null,
          durationMinutes: draft.durationMinutes,
          category,
          pathId,
          label: "Official Prayer",
        }),
      });
      if (res.ok) {
        router.push(`/dashboard/paths/${pathId}`);
        return;
      }
      setError(await readApiError(res));
    } finally {
      setSaving(false);
    }
  };

  const deleteGuide = async () => {
    if (!token || !confirm("Delete this guide permanently?")) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${guideId}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (res.ok) router.push(`/dashboard/paths/${pathId}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner />;

  if (!draft) {
    return (
      <>
        <PageHeader title="Guide not found" backHref={`/dashboard/paths/${pathId}`} backLabel="Path" />
        <p className="text-[12px] text-[var(--color-muted)]">This guide may have been removed.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit guide" backHref={`/dashboard/paths/${pathId}`} backLabel={pathName} />
      <div className={`${panelCls} p-3 sm:p-4`}>
        <PathGuideForm draft={draft} onChange={setDraft} token={token} disabled={saving} />
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Save"
          primaryLoading={saving}
          primaryDisabled={!draft.title.trim() || deleting}
          onPrimary={() => void save()}
          onCancel={() => router.push(`/dashboard/paths/${pathId}`)}
        />
        <button
          type="button"
          disabled={deleting || saving}
          onClick={() => void deleteGuide()}
          className={btnDangerOutline + " mt-3"}
        >
          {deleting ? "Deleting…" : "Delete guide"}
        </button>
      </div>
    </>
  );
}
