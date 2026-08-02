/**
 * Who may Boost a prayer (opt-in on create / on approval).
 *
 * Free users: one lifetime Boost (`free_boost_used_at`).
 * Paid (`premium`) and legacy trial subscribers: unlimited Boost.
 * Admins: unlimited.
 *
 * Mirrors `mobile/lib/serverSubscription.ts` — keep them in sync.
 */
export const UNLIMITED_BOOST_TIERS: ReadonlySet<string> = new Set(["premium", "trial"]);

/** @deprecated Use UNLIMITED_BOOST_TIERS — kept for tests migrating off trial-only naming. */
export const BOOST_TIERS = UNLIMITED_BOOST_TIERS;

export const FREE_BOOST_EXHAUSTED_MESSAGE =
  "You've used your free Prayer Boost. Subscribe for unlimited Prayer Boosts and to support the Get Praying community.";

/** @deprecated Use FREE_BOOST_EXHAUSTED_MESSAGE */
export const TRIAL_BOOST_EXHAUSTED_MESSAGE = FREE_BOOST_EXHAUSTED_MESSAGE;

export function subscriptionTierGrantsUnlimitedBoost(
  subscription: string | null | undefined,
): boolean {
  return UNLIMITED_BOOST_TIERS.has(String(subscription ?? "").toLowerCase());
}

/** @deprecated Use subscriptionTierGrantsUnlimitedBoost */
export function subscriptionTierGrantsBoost(
  subscription: string | null | undefined,
): boolean {
  return subscriptionTierGrantsUnlimitedBoost(subscription);
}

export function isTrialSubscription(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "trial";
}

export function isFreeSubscription(subscription: string | null | undefined): boolean {
  const tier = String(subscription ?? "free").toLowerCase();
  return tier === "free";
}

export function userIsBoostEligible(
  user: { role?: string | null; subscription?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (subscriptionTierGrantsUnlimitedBoost(user.subscription)) return true;
  return isFreeSubscription(user.subscription);
}

export function userFreeBoostConsumed(
  user: { subscription?: string | null; freeBoostUsedAt?: Date | string | null } | null | undefined,
): boolean {
  if (!user || !isFreeSubscription(user.subscription)) return false;
  return user.freeBoostUsedAt != null;
}

/** @deprecated Use userFreeBoostConsumed */
export function userTrialBoostUsed(
  user: { subscription?: string | null; freeBoostUsedAt?: Date | string | null } | null | undefined,
): boolean {
  return userFreeBoostConsumed(user);
}

export async function userCanApplyBoost(
  user: {
    id: number;
    role?: string | null;
    subscription?: string | null;
    freeBoostUsedAt?: Date | string | null;
  } | null | undefined,
  opts?: { freeHasPendingOrUsed?: boolean },
): Promise<boolean> {
  if (!user || !userIsBoostEligible(user)) return false;
  if (user.role === "admin") return true;
  if (subscriptionTierGrantsUnlimitedBoost(user.subscription)) return true;
  if (userFreeBoostConsumed(user)) return false;
  if (opts?.freeHasPendingOrUsed) return false;
  return true;
}

/** Human-readable error when Boost is unavailable (402 from API). */
export async function boostAvailabilityError(
  user: {
    id: number;
    role?: string | null;
    subscription?: string | null;
    freeBoostUsedAt?: Date | string | null;
  } | null | undefined,
  opts?: { freeHasPendingOrUsed?: boolean },
): Promise<string | null> {
  if (!user || !userIsBoostEligible(user)) {
    return FREE_BOOST_EXHAUSTED_MESSAGE;
  }
  if (user.role === "admin") return null;
  if (subscriptionTierGrantsUnlimitedBoost(user.subscription)) return null;
  if (userFreeBoostConsumed(user) || opts?.freeHasPendingOrUsed) {
    return FREE_BOOST_EXHAUSTED_MESSAGE;
  }
  return null;
}
