export const PREMIUM_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

/**
 * Events that revoke access. ONLY `EXPIRATION` — it fires when the entitlement
 * has actually lapsed (paid period / free trial fully ended).
 *
 * Deliberately NOT here:
 * - `CANCELLATION`: the user turned off auto-renew (or got a refund-cancel). With
 *   auto-renew off they keep access until the period ends; RevenueCat sends
 *   `EXPIRATION` at that point. Revoking on CANCELLATION would strip access the
 *   user already paid for (the bug this guards against).
 * - `BILLING_ISSUE`: a renewal charge failed (e.g. insufficient funds). This opens
 *   the store billing-retry / grace period; access continues while the store
 *   retries. If it ultimately fails, `EXPIRATION` arrives and revokes then.
 */
export const FREE_EVENTS = new Set(["EXPIRATION"]);

/** Events acknowledged but intentionally non-destructive (no tier change). */
export const NON_DESTRUCTIVE_EVENTS = new Set(["CANCELLATION", "BILLING_ISSUE"]);

export type SubscriptionTier = "premium" | "trial" | "free";

export function parseUserId(appUserId: string | undefined): number | null {
  if (!appUserId?.trim()) return null;
  const id = Number.parseInt(appUserId.trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Maps a RevenueCat webhook event to our DB `users.subscription` tier.
 * Returns `null` when the event should be ignored (no DB write) — including
 * CANCELLATION/BILLING_ISSUE, where access must continue until EXPIRATION.
 */
export function subscriptionFromEvent(
  eventType: string,
  periodType: string | undefined,
): SubscriptionTier | null {
  if (FREE_EVENTS.has(eventType)) return "free";
  // CANCELLATION / BILLING_ISSUE: keep current tier; access ends at EXPIRATION.
  if (NON_DESTRUCTIVE_EVENTS.has(eventType)) return null;
  if (!PREMIUM_EVENTS.has(eventType)) return null;

  const period = String(periodType ?? "").toUpperCase();
  if (period === "TRIAL" || period === "INTRO") return "trial";
  // INITIAL_PURCHASE / PRODUCT_CHANGE without period_type is almost always a store free
  // trial or tier switch mid-trial — treat as trial until the first paid renewal.
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
