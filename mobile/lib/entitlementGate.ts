import type { User } from "@workspace/api-client-react";
import { isStaffUser } from "@/lib/staffAccess";

export type EntitlementGateState = {
  enabled: boolean;
  isReady: boolean;
  isEntitled: boolean;
  isCheckingSubscription?: boolean;
};

/** Routes reachable without an active RevenueCat entitlement (hard paywall bypass). */
export function isRouteExemptFromEntitlementGate(pathname: string, segments: string[]): boolean {
  const head = segments[0] ?? "";
  if (head === "(auth)" || head === "(paywall)") return true;
  if (pathname.startsWith("/(auth)") || pathname.startsWith("/(paywall)")) return true;

  const exemptExact = new Set([
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/settings",
    "/onboarding",
  ]);
  if (exemptExact.has(pathname)) return true;

  return false;
}

/** True when a signed-in non-staff user must subscribe before viewing app content. */
export function userNeedsEntitlementGate(
  user: User | null | undefined,
  rc: EntitlementGateState,
  pathname: string,
  segments: string[],
): boolean {
  if (!user) return false;
  if (!user.isEmailVerified) return false;
  if (isStaffUser(user)) return false;
  if (isRouteExemptFromEntitlementGate(pathname, segments)) return false;
  if (!rc.enabled) return false;
  return !rc.isEntitled;
}

export function entitlementGateIsLoading(
  user: User | null | undefined,
  rc: EntitlementGateState,
  pathname: string,
  segments: string[],
): boolean {
  if (!user) return false;
  if (!user.isEmailVerified) return false;
  if (isStaffUser(user)) return false;
  if (isRouteExemptFromEntitlementGate(pathname, segments)) return false;
  if (!rc.enabled) return false;
  return !rc.isReady || !!rc.isCheckingSubscription;
}
