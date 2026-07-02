import type { User } from "@workspace/api-client-react";

/** DB tier written by the RevenueCat webhook. */
export function isServerPaidPremium(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "premium";
}

export function isServerTrialSubscription(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "trial";
}

/**
 * Subscription tiers that may Boost at all (paid unlimited; trial once).
 * Mirrors `artifacts/api-server/src/lib/boostEligibility.ts`.
 */
const BOOST_TIERS = new Set(["premium", "trial"]);

export function subscriptionTierGrantsBoost(subscription: string | null | undefined): boolean {
  return BOOST_TIERS.has(String(subscription ?? "").toLowerCase());
}

/** Whether the user's tier allows Boost in principle (not whether they still have quota). */
export function isServerBoostEligible(user: Pick<User, "role" | "subscription"> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return subscriptionTierGrantsBoost(user.subscription);
}

/** Client-side Boost availability after server sync (/auth/me `trialBoostUsed`). */
export function userCanUseBoostNow(
  user: (Pick<User, "role" | "subscription"> & { trialBoostUsed?: boolean }) | null | undefined,
): boolean {
  if (!isServerBoostEligible(user)) return false;
  if (user?.role === "admin") return true;
  if (isServerTrialSubscription(user?.subscription) && user?.trialBoostUsed) return false;
  return true;
}
