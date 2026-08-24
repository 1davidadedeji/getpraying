/**
 * When a post becomes visible on the public feed.
 * Pending media keeps `created_at` in the past; `approved_at` is when it actually appears.
 */
export function feedVisibleAt(createdAt: Date, approvedAt: Date | null | undefined): Date {
  return approvedAt ?? createdAt;
}

export function isFeedItemNewerThanWatermark(
  createdAt: Date,
  approvedAt: Date | null | undefined,
  watermark: Date,
): boolean {
  return feedVisibleAt(createdAt, approvedAt).getTime() > watermark.getTime();
}
