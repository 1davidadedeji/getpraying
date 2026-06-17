import { ApiError } from "@workspace/api-client-react";

/**
 * Poll intervals intentionally staggered to prevent simultaneous iOS NSURLSession
 * connection bursts. iOS HTTP/1.1 allows max 6 concurrent connections per host;
 * overlapping polls saturate the pool and queue subsequent requests at the native
 * layer, producing 20+ second apparent hangs on physical devices.
 */

/** Poll open post detail for pray/save/comment counts while the screen is focused. */
export const LIVE_POST_POLL_MS = 22_000;
/** Poll comments thread while post detail is focused. */
export const LIVE_COMMENTS_POLL_MS = 17_000;
/** Poll notifications list + tab badge while alerts tab is focused. */
export const LIVE_NOTIFICATIONS_POLL_MS = 24_000;

export function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
