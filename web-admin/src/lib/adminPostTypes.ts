"use client";

export type StaffPostReport = {
  reporterUsername: string;
  reporterDisplayName: string | null;
  reason: string;
  createdAt: string;
};

export type AdminPostDetail = {
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
  flagCount?: number;
  moderationReason?: string | null;
  isPremium?: boolean;
  isReported?: boolean;
  reports?: StaffPostReport[];
};

export function postIsReported(post: Pick<AdminPostDetail, "isReported" | "flagReason" | "flagCount" | "reports">): boolean {
  if (post.isReported) return true;
  if ((post.reports?.length ?? 0) > 0) return true;
  if ((post.flagCount ?? 0) > 0) return true;
  return Boolean(post.flagReason?.trim());
}
