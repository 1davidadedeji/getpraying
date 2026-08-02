"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminPostBody } from "@/components/dashboard/AdminPostBody";
import { PremiumToggle } from "@/components/dashboard/PremiumToggle";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { inputCls, panelCls, helpMutedSmCls, formErrorSmCls, btnModerationApproveCls, btnModerationDeclineConfirmCls, btnModerationDeclineOutlineCls, btnModerationCancelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { useAdminPost } from "@/lib/useAdminPost";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";

export default function ModerationPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.postId);
  const { token } = useAuth();
  const { post, loading, error, reload } = useAdminPost(postId);
  const [actionId, setActionId] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [premiumSaving, setPremiumSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (post) setIsPremium(post.isPremium ?? false);
  }, [post]);

  const approve = async () => {
    if (!token) return;
    setActionId(postId);
    setActionError(null);
    try {
      const res = await adminFetch(`/admin/posts/${postId}/approve`, token, { method: "POST" });
      if (res.ok) {
        router.push("/dashboard/moderation");
        return;
      }
      setActionError("Could not approve");
    } finally {
      setActionId(null);
    }
  };

  const savePremium = async (next: boolean) => {
    if (!token) return;
    setPremiumSaving(true);
    setActionError(null);
    const prev = isPremium;
    setIsPremium(next);
    try {
      const res = await adminFetch(`/admin/posts/${postId}/premium`, token, {
        method: "PATCH",
        body: JSON.stringify({ isPremium: next }),
      });
      if (!res.ok) {
        setIsPremium(prev);
        setActionError("Could not update premium flag");
        return;
      }
      await reload();
    } catch {
      setIsPremium(prev);
      setActionError("Could not update premium flag");
    } finally {
      setPremiumSaving(false);
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
      const res = await adminFetch(`/admin/posts/${postId}/decline`, token, { method: "POST", body: JSON.stringify({ reason: declineReason.trim()  }),
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
        <p className={helpMutedSmCls}>{error ?? "Post unavailable."}</p>
      </>
    );
  }

  const canModerate = post.status === "pending";

  return (
    <>
      <PageHeader title="Review" backHref="/dashboard/moderation" backLabel="Moderation" />
      <AdminPostBody post={post} />

      <PremiumToggle
        className="mt-2"
        checked={isPremium}
        disabled={premiumSaving}
        onChange={(next) => void savePremium(next)}
      />

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
            {actionError ? <p className={`mt-1.5 ${formErrorSmCls}`}>{actionError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={actionId === postId || declineReason.trim().length < 3}
                onClick={() => void decline()}
                className={btnModerationDeclineConfirmCls}
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
                className={btnModerationCancelCls}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {actionError ? <p className={`mt-2 ${formErrorSmCls}`}>{actionError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={actionId === postId}
                onClick={() => void approve()}
                className={btnModerationApproveCls}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className={btnModerationDeclineOutlineCls}
              >
                Decline
              </button>
            </div>
          </>
        )
      ) : (
        <p className={`mt-2 ${helpMutedSmCls}`}>This post is not pending review.</p>
      )}
    </>
  );
}
