/** Notifies an open post detail screen to reload comments (e.g. repeat notification tap). */
type PostDetailRefreshListener = (postId: number) => void;

const listeners = new Set<PostDetailRefreshListener>();

export function subscribePostDetailRefresh(listener: PostDetailRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestPostDetailRefresh(postId: number): void {
  if (!Number.isFinite(postId) || postId <= 0) return;
  listeners.forEach((listener) => listener(postId));
}
