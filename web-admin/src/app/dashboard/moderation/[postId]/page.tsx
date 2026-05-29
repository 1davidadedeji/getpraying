"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPostBody } from "@/components/dashboard/AdminPostBody";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { inputCls, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { useAdminPost } from "@/lib/useAdminPost";
import { apiUrl, authHeaders } from "@/lib/api";

export default function ModerationPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.postId);
  const { token } = useAuth();
  const { post, loading, error } = useAdminPost(postId);
  const [actionId, setActionId] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const approve = async () => {
    if (!token) return;
    setActionId(postId);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/admin/posts/${postId}/approve`), {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) {
        router.push("/dashboard/moderation");
        return;
      }
      setActionError("Could not approve");
    } finally {
      setActionId(null);
    }
  };

  const decline = async () => {
    if (!token || declineReason.trim().length < 3) {
      setActionError("Reason must be at least 3 characters.");
      return;
    }
    setActionId(postId);
    setActionError(null);
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
      setActionError("Could not decline");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <Spinner />;

  if (!post) {
    return (
      <>
        <PageHeader title="Not found" backHref="/dashboard/moderation" backLabel="Moderation" />
        <p className="text-[11px] text-[var(--color-muted)]">{error ?? "Post unavailable."}</p>
      </>
    );
  }

  const canModerate = post.status === "pending";

  return (
    <>
      <PageHeader title="Review" backHref="/dashboard/moderation" backLabel="Moderation" />
      <AdminPostBody post={post} />

      {canModerate ? (
        declining ? (
          <div className={`${panelCls} mt-2 p-2.5`}>
            <input
              autoFocus
              className={inputCls}
              placeholder="Decline reason…"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
            {actionError ? <p className="mt-1.5 text-[11px] text-[var(--color-danger)]">{actionError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={actionId === postId || declineReason.trim().length < 3}
                onClick={() => void decline()}
                className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Confirm decline
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeclining(false);
                  setDeclineReason("");
                  setActionError(null);
                }}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {actionError ? <p className="mt-2 text-[11px] text-[var(--color-danger)]">{actionError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={actionId === postId}
                onClick={() => void approve()}
                className="rounded-md bg-[var(--color-success)] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-[11px] text-[var(--color-danger)]"
              >
                Decline
              </button>
            </div>
          </>
        )
      ) : (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">This post is not pending review.</p>
      )}
    </>
  );
}
