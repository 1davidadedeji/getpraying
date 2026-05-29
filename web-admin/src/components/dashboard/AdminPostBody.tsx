"use client";

import type { AdminPostDetail } from "@/lib/adminPostTypes";
import { postIsReported } from "@/lib/adminPostTypes";
import { panelCls } from "@/components/dashboard/form-styles";

export function PostStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-50 text-green-700",
    declined: "bg-red-50 text-[var(--color-danger)]",
    pending: "bg-yellow-50 text-yellow-700",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${map[status] ?? "bg-[var(--color-border)] text-[var(--color-muted)]"}`}
    >
      {status}
    </span>
  );
}

export function ReportedBadge() {
  return (
    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-danger)]">
      Reported
    </span>
  );
}

export function AdminPostBody({ post }: { post: AdminPostDetail }) {
  const reported = postIsReported(post);

  return (
    <div className={`${panelCls} p-2.5 sm:p-3`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold text-[var(--color-primary)]">
          {post.isAnonymous ? "Anonymous" : (post.authorDisplayName ?? post.authorUsername ?? "Unknown")}
        </span>
        {!post.isAnonymous && post.authorUsername ? (
          <span className="text-[10px] text-[var(--color-muted)]">@{post.authorUsername}</span>
        ) : null}
        <PostStatusBadge status={post.status} />
        {reported ? <ReportedBadge /> : null}
        {post.category ? (
          <span className="rounded bg-[var(--color-flame)]/10 px-1.5 py-0.5 text-[10px] capitalize text-[var(--color-flame)]">
            {post.category}
          </span>
        ) : null}
        {post.mediaType ? (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] capitalize text-blue-600">{post.mediaType}</span>
        ) : null}
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          {new Date(post.createdAt).toLocaleString()} · {post.prayCount} 🙏
        </span>
      </div>

      <p className="whitespace-pre-wrap text-[13px] leading-snug text-[var(--color-primary)]">
        {post.content?.trim() ? post.content : "(No text content)"}
      </p>

      {post.moderationReason ? (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">
          Prior decline: <span className="text-[var(--color-danger)]">{post.moderationReason}</span>
        </p>
      ) : null}

      {post.flagReason ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-[var(--color-danger)]">
          Flag: {post.flagReason}
        </p>
      ) : null}

      {(post.reports?.length ?? 0) > 0 ? (
        <div className="mt-2 rounded border border-red-200/80 bg-red-50/50 px-2 py-1.5">
          <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--color-danger)]">Reports</p>
          <ul className="space-y-1">
            {post.reports!.map((r, i) => (
              <li key={`${r.reporterUsername}-${i}`} className="text-[11px] text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-primary)]">
                  {r.reporterDisplayName ?? r.reporterUsername}
                </span>
                {" — "}
                {r.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {post.mediaUrl && post.mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt="" className="mt-2 max-h-56 rounded border border-[var(--color-border)] object-contain" />
      ) : null}
    </div>
  );
}
