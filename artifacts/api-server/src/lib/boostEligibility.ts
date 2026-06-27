/**
 * Who may Boost a prayer (auto-boost on approval).
 *
 * Policy: a store free trial is an active, committed subscription — the user is
 * charged when it converts unless they cancel — so trial subscribers get Boost
 * too, not just fully-paid ones. Both the `premium` (paid) and `trial` DB tiers
 * written by the RevenueCat webhook (`subscriptionFromEvent`) qualify; `free`
 * does not. Mirrors `mobile/lib/serverSubscription.ts` — keep them in sync.
 */
export const BOOST_TIERS: ReadonlySet<string> = new Set(["premium", "trial"]);

export function subscriptionTierGrantsBoost(
  subscription: string | null | undefined,
): boolean {
  return BOOST_TIERS.has(String(subscription ?? "").toLowerCase());
}

export function userIsBoostEligible(
  user: { role?: string | null; subscription?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return subscriptionTierGrantsBoost(user.subscription);
}
