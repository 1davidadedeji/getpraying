"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { LectureLessonFields } from "@/components/dashboard/LectureLessonFields";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  LectureTracksEditor,
  tracksFromApi,
  tracksToPayload,
  validateTrackDrafts,
  type LectureTrackDraft,
} from "@/components/dashboard/LectureTracksEditor";
import { panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";

export default function EditLecturePage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const id = Number(params.id);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [scripture, setScripture] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>();
  const [tracks, setTracks] = useState<LectureTrackDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(id)) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/library/official?category=lectures&limit=60"), {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.prayers ?? data.items ?? [];
      const row = rows.find((l: { id: number }) => l.id === id);
      if (!row) {
        setNotFound(true);
        return;
      }
      setTitle(row.title ?? "");
      setSubtitle(row.subtitle ?? "");
      setContent(row.content ?? "");
      setScripture(row.scripture ?? "");
      setDurationMinutes(row.durationMinutes ?? undefined);
      setTracks(tracksFromApi(row.tracks));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !title.trim() || !content.trim()) return;
    const trackErr = validateTrackDrafts(tracks);
    if (trackErr) {
      setError(trackErr);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/official-prayers/${id}`), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          content: content.trim(),
          scripture: scripture.trim() || null,
          durationMinutes,
          category: "lectures",
          pathId: null,
          tracks: tracksToPayload(tracks),
        }),
      });
      if (res.ok) {
        router.push("/dashboard/lectures");
        return;
      }
      setError(await readApiError(res));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  if (notFound) {
    return (
      <>
        <PageHeader title="Lesson not found" backHref="/dashboard/lectures" backLabel="Lectures" />
        <p className="text-[12px] text-[var(--color-muted)]">This lesson may have been removed.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit lesson" backHref="/dashboard/lectures" backLabel="Lectures" />
      <div className={`${panelCls} space-y-3 p-3 sm:p-4`}>
        <LectureLessonFields
          draft={{ title, subtitle, content, scripture, durationMinutes }}
          onChange={(p) => {
            if (p.title !== undefined) setTitle(p.title);
            if (p.subtitle !== undefined) setSubtitle(p.subtitle);
            if (p.content !== undefined) setContent(p.content);
            if (p.scripture !== undefined) setScripture(p.scripture);
            if (p.durationMinutes !== undefined) setDurationMinutes(p.durationMinutes);
          }}
          disabled={saving}
        />
        <LectureTracksEditor token={token} disabled={saving} tracks={tracks} onChange={setTracks} />
        {error ? <p className="text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Save lesson"
          primaryLoading={saving}
          primaryDisabled={!title.trim() || !content.trim()}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/lectures")}
        />
      </div>
    </>
  );
}
