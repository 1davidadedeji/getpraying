export const PREMIUM_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);
export const FREE_EVENTS = new Set(["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]);

export type SubscriptionTier = "premium" | "trial" | "free";

export function parseUserId(appUserId: string | undefined): number | null {
  if (!appUserId?.trim()) return null;
  const id = Number.parseInt(appUserId.trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Maps a RevenueCat webhook event to our DB `users.subscription` tier.
 * Returns `null` when the event should be ignored (no DB write).
 */
export function subscriptionFromEvent(
  eventType: string,
  periodType: string | undefined,
): SubscriptionTier | null {
  if (FREE_EVENTS.has(eventType)) return "free";
  if (!PREMIUM_EVENTS.has(eventType)) return null;

  const period = String(periodType ?? "").toUpperCase();
  if (period === "TRIAL" || period === "INTRO") return "trial";
  // INITIAL_PURCHASE / PRODUCT_CHANGE without period_type is almost always a store free
  // trial or tier switch mid-trial — treat as trial so auto-boost stays blocked until
  // the first paid renewal webhook arrives.
  if ((eventType === "INITIAL_PURCHASE" || eventType === "PRODUCT_CHANGE") && !period) {
    return "trial";
  }
  return "premium";
}

export function verifyRevenueCatWebhookSecret(
  authorizationHeader: string | undefined,
  configuredSecret: string | undefined,
): "ok" | "not_configured" | "unauthorized" {
  const secret = configuredSecret?.trim();
  if (!secret) return "not_configured";
  const header = authorizationHeader ?? "";
  if (header !== `Bearer ${secret}`) return "unauthorized";
  return "ok";
}
