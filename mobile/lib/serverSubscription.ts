import type { User } from "@workspace/api-client-react";

/** DB tier written by the RevenueCat webhook. */
export function isServerPaidPremium(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "premium";
}

/**
 * Subscription tiers that grant Boost. Trial counts: a store free trial is an
 * active, committed subscription. Mirrors the server's
 * `artifacts/api-server/src/lib/boostEligibility.ts` — keep them in sync.
 */
const BOOST_TIERS = new Set(["premium", "trial"]);

export function subscriptionTierGrantsBoost(subscription: string | null | undefined): boolean {
  return BOOST_TIERS.has(String(subscription ?? "").toLowerCase());
}

/** Whether the API will auto-boost / honor Boost on post create. */
export function isServerBoostEligible(user: Pick<User, "role" | "subscription"> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return subscriptionTierGrantsBoost(user.subscription);
}
