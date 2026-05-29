"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { inputCls, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

interface PostDetail {
  id: number;
  content: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  createdAt: string;
  prayCount: number;
  category: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  isAnonymous: boolean;
  status: string;
  flagReason?: string | null;
}

export default function ModerationPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.postId);
  const { token } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(postId)) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/posts/${postId}`), { headers: authHeaders(token) });
      if (!res.ok) {
        setPost(null);
        return;
      }
      setPost(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!token) return;
    setActionId(postId);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/posts/${postId}/approve`), {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) {
        router.push("/dashboard/moderation");
        return;
      }
      setError("Could not approve post");
    } finally {
      setActionId(null);
    }
  };

  const decline = async () => {
    if (!token || declineReason.trim().length < 3) {
      setError("Decline reason must be at least 3 characters.");
      return;
    }
    setActionId(postId);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/posts/${postId}/decline`), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      if (res.ok) {
        router.push("/dashboard/moderation");
        return;
      }
      setError("Could not decline post");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <Spinner />;

  if (!post) {
    return (
      <>
        <PageHeader title="Post not found" backHref="/dashboard/moderation" backLabel="Moderation" />
        <p className="text-[12px] text-[var(--color-muted)]">This post may have already been reviewed.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Review post" backHref="/dashboard/moderation" backLabel="Moderation" />

      <div className={`${panelCls} mb-3 p-3`}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--color-primary)]">
            {post.isAnonymous ? "Anonymous" : (post.authorDisplayName ?? post.authorUsername ?? "Unknown")}
          </span>
          {!post.isAnonymous && post.authorUsername ? (
            <span className="text-[10px] text-[var(--color-muted)]">@{post.authorUsername}</span>
          ) : null}
          {post.category ? (
            <span className="rounded bg-[var(--color-flame)]/10 px-1.5 py-0.5 text-[10px] capitalize text-[var(--color-flame)]">
              {post.category}
            </span>
          ) : null}
          {post.mediaType ? (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] capitalize text-blue-600">{post.mediaType}</span>
          ) : null}
          <span className="ml-auto text-[10px] text-[var(--color-muted)]">{new Date(post.createdAt).toLocaleString()}</span>
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-primary)]">{post.content}</p>
        {post.flagReason ? (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-[var(--color-danger)]">
            Report: {post.flagReason}
          </p>
        ) : null}
        {post.mediaUrl && post.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="" className="mt-3 max-h-64 rounded-md border border-[var(--color-border)] object-contain" />
        ) : null}
      </div>

      {declining ? (
        <div className={`${panelCls} p-3`}>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-[var(--color-muted)]">
            Decline reason *
          </label>
          <input
            autoFocus
            className={inputCls}
            placeholder="Reason for declining…"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionId === postId || declineReason.trim().length < 3}
              onClick={() => void decline()}
              className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              Confirm decline
            </button>
            <button
              type="button"
              onClick={() => {
                setDeclining(false);
                setDeclineReason("");
                setError(null);
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {error ? <p className="mb-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionId === postId}
              onClick={() => void approve()}
              className="rounded-md bg-[var(--color-success)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              {actionId === postId ? "…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-[12px] text-[var(--color-danger)]"
            >
              Decline
            </button>
          </div>
        </>
      )}
    </>
  );
}
