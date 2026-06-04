import { ApiError } from "@workspace/api-client-react";

/** Poll open post detail for pray/save/comment counts while the screen is focused. */
export const LIVE_POST_POLL_MS = 8_000;
/** Poll comments thread while post detail is focused. */
export const LIVE_COMMENTS_POLL_MS = 6_000;
/** Poll notifications list + tab badge while app is active. */
export const LIVE_NOTIFICATIONS_POLL_MS = 12_000;
/** Refresh feed engagement counts while Feed tab is focused. */
export const LIVE_FEED_ENGAGEMENT_POLL_MS = 15_000;

export function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
