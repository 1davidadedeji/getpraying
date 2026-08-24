/** Comments 404 must not wipe a post we already loaded (requeue / race / block mismatch). */
export function shouldMarkPostUnavailableFromComments(
  commentsStatus: number,
  hasLoadedPost: boolean,
): boolean {
  return commentsStatus === 404 && !hasLoadedPost;
}
