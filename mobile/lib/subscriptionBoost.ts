import type { User } from "@workspace/api-client-react";
import { isTrialActive } from "@/lib/trial";

/** Mirrors api-server `userCanUsePremiumBoost` (+ client RevenueCat entitlement). */
export function viewerHasPremiumCapabilities(
  user: User | null,
  revenueCat: { enabled: boolean; isReady: boolean; isEntitled: boolean },
): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;

  if (isTrialActive(user.trialStartsAt)) return true;

  const tier = String(user.subscription ?? "").toLowerCase();
  if (["active", "premium", "paid", "subscribed", "pro", "plus"].includes(tier)) return true;

  if (revenueCat.enabled && revenueCat.isReady && revenueCat.isEntitled) return true;

  return false;
}
