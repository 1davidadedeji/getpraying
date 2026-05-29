"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  EMPTY_PATH_GUIDE,
  PathGuideForm,
  type PathGuideDraft,
} from "@/components/dashboard/PathGuideForm";
import { panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";

export default function NewPathGuidePage() {
  const params = useParams();
  const router = useRouter();
  const pathId = Number(params.pathId);
  const { token } = useAuth();
  const [pathName, setPathName] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<PathGuideDraft>(EMPTY_PATH_GUIDE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(pathId)) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/library/paths/${pathId}`), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      setPathName(data.name ?? "Path");
      setCategory(data.category ?? "general");
    } finally {
      setLoading(false);
    }
  }, [token, pathId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !draft.title.trim() || !draft.audioUrl.trim()) {
      setError(!draft.audioUrl.trim() ? "Upload audio for this guide." : "Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const content = draft.content.trim() || draft.subtitle.trim() || draft.title.trim();
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          content,
          scripture: draft.scripture.trim() || null,
          audioUrl: draft.audioUrl.trim(),
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

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="New guide"
        description={pathName}
        backHref={`/dashboard/paths/${pathId}`}
        backLabel={pathName}
      />
      <div className={`${panelCls} p-3 sm:p-4`}>
        <PathGuideForm draft={draft} onChange={setDraft} token={token} disabled={saving} />
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Publish guide"
          primaryLoading={saving}
          primaryDisabled={!draft.title.trim()}
          onPrimary={() => void save()}
          onCancel={() => router.push(`/dashboard/paths/${pathId}`)}
        />
      </div>
    </>
  );
}
