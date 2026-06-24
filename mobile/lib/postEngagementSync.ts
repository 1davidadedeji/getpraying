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
  const extended = post as T & PostEngagementPatch;
  let changed = false;
  const next = { ...post } as T & PostEngagementPatch;

  if (patch.prayCount !== undefined && patch.prayCount !== post.prayCount) {
    next.prayCount = patch.prayCount;
    changed = true;
  }
  if (patch.hasPrayed !== undefined && patch.hasPrayed !== post.hasPrayed) {
    next.hasPrayed = patch.hasPrayed;
    changed = true;
  }
  if (patch.commentCount !== undefined && patch.commentCount !== extended.commentCount) {
    next.commentCount = patch.commentCount;
    changed = true;
  }
  if (patch.hasCommented !== undefined && patch.hasCommented !== extended.hasCommented) {
    next.hasCommented = patch.hasCommented;
    changed = true;
  }
  if (patch.saveCount !== undefined && patch.saveCount !== extended.saveCount) {
    next.saveCount = patch.saveCount;
    changed = true;
  }
  if (patch.isSaved !== undefined && patch.isSaved !== post.isSaved) {
    next.isSaved = patch.isSaved;
    changed = true;
  }

  return changed ? (next as T) : post;
}

type RemoveListener = (postId: number) => void;

const removeListeners = new Set<RemoveListener>();

/** Broadcast post deletion so lists and saved caches drop the row immediately. */
export function publishPostRemoved(postId: number): void {
  if (!Number.isFinite(postId) || postId <= 0) return;
  removeListeners.forEach((fn) => fn(postId));
}

export function subscribePostRemoved(listener: RemoveListener): () => void {
  removeListeners.add(listener);
  return () => {
    removeListeners.delete(listener);
  };
}

export function filterRemovedPost<T extends { id: number }>(list: T[], postId: number): T[] {
  return list.filter((p) => p.id !== postId);
}

export function filterPostsByAuthorUsername<T extends { authorUsername?: string | null }>(
  posts: T[],
  username: string,
): T[] {
  const needle = username.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter((p) => (p.authorUsername ?? "").toLowerCase() !== needle);
}

type BlockListener = (username: string) => void;
const blockListeners = new Set<BlockListener>();

export function publishUserBlocked(username: string): void {
  const handle = username.trim();
  if (!handle) return;
  blockListeners.forEach((fn) => fn(handle));
}

export function subscribeUserBlocked(listener: BlockListener): () => void {
  blockListeners.add(listener);
  return () => {
    blockListeners.delete(listener);
  };
}

/** Saved-library lists: drop unsaved rows; otherwise merge engagement fields. */
export function updateSavedPostsList<T extends Post>(posts: T[], updated: T): T[] {
  if (!updated.isSaved) return filterRemovedPost(posts, updated.id);
  if (!posts.some((p) => p.id === updated.id)) return posts;
  return posts.map((p) => (p.id === updated.id ? updated : p));
}
