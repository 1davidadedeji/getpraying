"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPostBody } from "@/components/dashboard/AdminPostBody";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { btnDangerOutline, btnGhost, btnPrimary, inputCls, panelCls } from "@/components/dashboard/form-styles";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { useAdminPost } from "@/lib/useAdminPost";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.postId);
  const { token, user } = useAuth();
  const { post, loading, error } = useAdminPost(postId);
  const isAdmin = user?.role === "admin";
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requeue = async () => {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await adminFetch(`/admin/posts/${postId}/requeue`, token, { method: "POST" });
      if (res.ok) {
        router.push(`/dashboard/moderation/${postId}`);
        return;
      }
      setActionError("Re-queue failed");
    } finally {
      setBusy(false);
    }
  };

  const removePost = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/posts/${postId}/remove`, token, { method: "DELETE", body: JSON.stringify({ reason: removeReason.trim() || "Admin removal"  }),
      });
      router.push("/dashboard/posts");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  if (!post) {
    return (
      <>
        <PageHeader title="Not found" backHref="/dashboard/posts" backLabel="All posts" />
        <p className="text-[11px] text-[var(--color-muted)]">{error ?? "Post unavailable."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Post" backHref="/dashboard/posts" backLabel="All posts" />
      <AdminPostBody post={post} />

      {isAdmin ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {post.status === "declined" || post.status === "approved" ? (
            <button type="button" disabled={busy} onClick={() => void requeue()} className={btnGhost}>
              Re-queue
            </button>
          ) : null}
          {post.status === "pending" ? (
            <Link href={`/dashboard/moderation/${postId}`} className={btnPrimary}>
              Review
            </Link>
          ) : null}
          {!confirmRemove ? (
            <button type="button" onClick={() => setConfirmRemove(true)} className={btnDangerOutline}>
              Remove
            </button>
          ) : (
            <div className={`${panelCls} flex w-full flex-wrap items-center gap-1.5 p-2`}>
              <input
                className={`${inputCls} max-w-xs flex-1`}
                placeholder="Reason (optional)"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={() => void removePost()} className={btnDangerOutline}>
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className={btnGhost}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}
      {actionError ? <p className="mt-1.5 text-[11px] text-[var(--color-danger)]">{actionError}</p> : null}
    </>
  );
}
