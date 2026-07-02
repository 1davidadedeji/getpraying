/**
 * Who may Boost a prayer (opt-in on create / on approval).
 *
 * Paid (`premium`) subscribers: unlimited Boost.
 * Trial (`trial`) subscribers: one Boost for the trial period.
 * Admins: unlimited.
 *
 * Mirrors `mobile/lib/serverSubscription.ts` — keep them in sync.
 */
export const BOOST_TIERS: ReadonlySet<string> = new Set(["premium", "trial"]);

export const TRIAL_BOOST_EXHAUSTED_MESSAGE =
  "You're on a 7-day trial, if you continue you can boost your prayer so the entire community gets notified of your needs.";

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

export function isTrialSubscription(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "trial";
}

export function userTrialBoostUsed(
  user: { subscription?: string | null; trialBoostUsedAt?: Date | string | null } | null | undefined,
): boolean {
  if (!user || !isTrialSubscription(user.subscription)) return false;
  return user.trialBoostUsedAt != null;
}

export async function userCanApplyBoost(
  user: {
    id: number;
    role?: string | null;
    subscription?: string | null;
    trialBoostUsedAt?: Date | string | null;
  } | null | undefined,
  opts?: { trialHasPendingOrUsed?: boolean },
): Promise<boolean> {
  if (!user || !userIsBoostEligible(user)) return false;
  if (user.role === "admin") return true;
  if (isTrialSubscription(user.subscription)) {
    if (userTrialBoostUsed(user)) return false;
    if (opts?.trialHasPendingOrUsed) return false;
  }
  return true;
}

/** Human-readable error when Boost is unavailable (402 from API). */
export async function boostAvailabilityError(
  user: {
    id: number;
    role?: string | null;
    subscription?: string | null;
    trialBoostUsedAt?: Date | string | null;
  } | null | undefined,
  opts?: { trialHasPendingOrUsed?: boolean },
): Promise<string | null> {
  if (!user || !userIsBoostEligible(user)) {
    return "Subscribe to Boost your prayer.";
  }
  if (user.role === "admin") return null;
  if (isTrialSubscription(user.subscription)) {
    if (userTrialBoostUsed(user) || opts?.trialHasPendingOrUsed) {
      return TRIAL_BOOST_EXHAUSTED_MESSAGE;
    }
  }
  return null;
}
