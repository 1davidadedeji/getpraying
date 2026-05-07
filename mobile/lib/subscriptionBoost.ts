import type { User } from "@workspace/api-client-react";

/** Mirrors api-server `userCanUsePremiumBoost` (+ client RevenueCat entitlement). */
export function viewerHasPremiumCapabilities(
  user: User | null,
  revenueCat: { enabled: boolean; isReady: boolean; isEntitled: boolean },
): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;

  const trialStart = user.trialStartsAt ? new Date(user.trialStartsAt as any).getTime() : null;
  const trialActive = trialStart != null && Date.now() - trialStart < 7 * 24 * 60 * 60 * 1000;
  if (trialActive) return true;

  const tier = String(user.subscription ?? "").toLowerCase();
  if (["active", "premium", "paid", "subscribed", "pro", "plus"].includes(tier)) return true;

  if (revenueCat.enabled && revenueCat.isReady && revenueCat.isEntitled) return true;

  return false;
}
