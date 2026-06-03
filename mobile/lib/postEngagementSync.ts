import type { Post } from "@workspace/api-client-react";

export type PostEngagementPatch = {
  postId: number;
  prayCount?: number;
  hasPrayed?: boolean;
  commentCount?: number;
  hasCommented?: boolean;
  saveCount?: number;
  isSaved?: boolean;
};

type Listener = (patch: PostEngagementPatch) => void;

const listeners = new Set<Listener>();

/** Broadcast engagement changes so feed/profile lists update without a full reload. */
export function publishPostEngagement(patch: PostEngagementPatch): void {
  if (!Number.isFinite(patch.postId) || patch.postId <= 0) return;
  listeners.forEach((fn) => fn(patch));
}

export function subscribePostEngagement(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyEngagementPatch<T extends Post>(post: T, patch: PostEngagementPatch): T {
  if (post.id !== patch.postId) return post;
  return {
    ...post,
    ...(patch.prayCount !== undefined ? { prayCount: patch.prayCount } : {}),
    ...(patch.hasPrayed !== undefined ? { hasPrayed: patch.hasPrayed } : {}),
    ...(patch.commentCount !== undefined ? { commentCount: patch.commentCount } : {}),
    ...(patch.hasCommented !== undefined ? { hasCommented: patch.hasCommented } : {}),
    ...(patch.saveCount !== undefined ? { saveCount: patch.saveCount } : {}),
    ...(patch.isSaved !== undefined ? { isSaved: patch.isSaved } : {}),
  } as T;
}
