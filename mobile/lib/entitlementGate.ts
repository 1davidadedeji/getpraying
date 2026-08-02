import type { User } from "@workspace/api-client-react";
import { isStaffUser } from "@/lib/staffAccess";

export type EntitlementGateState = {
  enabled: boolean;
  isReady: boolean;
  isEntitled: boolean;
  isCheckingSubscription?: boolean;
};

/** Freemium: all signed-in routes are reachable without a subscription. */
export function isRouteExemptFromEntitlementGate(_pathname: string, _segments: string[]): boolean {
  return true;
}

/** Hard paywall removed — free users access the full app; premium is item-level. */
export function userNeedsEntitlementGate(
  _user: User | null | undefined,
  _rc: EntitlementGateState,
  _pathname: string,
  _segments: string[],
): boolean {
  return false;
}

export function entitlementGateIsLoading(
  _user: User | null | undefined,
  _rc: EntitlementGateState,
  _pathname: string,
  _segments: string[],
): boolean {
  return false;
}

/** True when deferred deep links / push targets may be applied. */
export function deferredNavigationReady(
  user: User | null | undefined,
  authLoading: boolean,
): boolean {
  if (authLoading) return false;
  if (!user?.isEmailVerified) return false;
  if (isStaffUser(user)) return true;
  return true;
}
