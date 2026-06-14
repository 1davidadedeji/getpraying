"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { LectureLessonFields } from "@/components/dashboard/LectureLessonFields";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  LectureTracksEditor,
  emptyTrackDraft,
  tracksToPayload,
  validateTrackDrafts,
  type LectureTrackDraft,
} from "@/components/dashboard/LectureTracksEditor";
import { panelCls } from "@/components/dashboard/form-styles";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";
import { scriptureForApi, contentForApi } from "@/lib/officialGuidePayload";

export default function NewLecturePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [scripture, setScripture] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>();
  const [tracks, setTracks] = useState<LectureTrackDraft[]>([emptyTrackDraft("Part 1")]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!token || !title.trim()) return;
    const trackErr = validateTrackDrafts(tracks);
    if (trackErr) {
      setError(trackErr);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/official-prayers", token, { method: "POST", body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          content: contentForApi(content, subtitle, title),
          scripture: scriptureForApi(scripture),
          durationMinutes,
          category: "lectures",
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

  return (
    <>
      <PageHeader title="New lesson" backHref="/dashboard/lectures" backLabel="Lectures" />
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
          primaryLabel="Create lesson"
          primaryLoading={saving}
          primaryDisabled={!title.trim()}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/lectures")}
        />
      </div>
    </>
  );
}
