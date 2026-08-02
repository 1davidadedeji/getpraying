import type { User } from "@workspace/api-client-react";

/** DB tier written by the RevenueCat webhook. */
export function isServerPaidPremium(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "premium";
}

export function isServerTrialSubscription(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "trial";
}

/** Legacy trial and paid premium get unlimited Boost. Mirrors server UNLIMITED_BOOST_TIERS. */
const UNLIMITED_BOOST_TIERS = new Set(["premium", "trial"]);

export function subscriptionTierGrantsUnlimitedBoost(
  subscription: string | null | undefined,
): boolean {
  return UNLIMITED_BOOST_TIERS.has(String(subscription ?? "").toLowerCase());
}

/** @deprecated Use subscriptionTierGrantsUnlimitedBoost */
export function subscriptionTierGrantsBoost(subscription: string | null | undefined): boolean {
  return subscriptionTierGrantsUnlimitedBoost(subscription);
}

/** Whether the user may Boost at all (free once, subscribers unlimited, admins unlimited). */
export function isServerBoostEligible(
  user: Pick<User, "role" | "subscription"> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (subscriptionTierGrantsUnlimitedBoost(user.subscription)) return true;
  return String(user?.subscription ?? "free").toLowerCase() === "free";
}

/** Client-side Boost quota after server sync (/auth/me `freeBoostUsed`). */
export function userCanUseBoostNow(
  user: (Pick<User, "role" | "subscription"> & { freeBoostUsed?: boolean }) | null | undefined,
): boolean {
  if (!isServerBoostEligible(user)) return false;
  if (user?.role === "admin") return true;
  if (subscriptionTierGrantsUnlimitedBoost(user?.subscription)) return true;
  return !user?.freeBoostUsed;
}

/** Subscribed users need RevenueCat sync; free-tier one-shot does not. */
export function userNeedsStoreEntitlementForBoost(
  user: Pick<User, "role" | "subscription"> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return false;
  return subscriptionTierGrantsUnlimitedBoost(user.subscription);
}
