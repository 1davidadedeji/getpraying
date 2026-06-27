import type { Href } from "expo-router";
import type { User } from "@workspace/api-client-react";
import type { ParsedDeepLink } from "@/lib/parseDeepLink";
import { deepLinkToHref } from "@/lib/parseDeepLink";
import { isStaffUser } from "@/lib/staffAccess";

type RevenueCatGate = {
  /** SDK configure + initial customer info complete (does not wait for StoreKit offerings). */
  isReady: boolean;
  enabled: boolean;
  isEntitled: boolean;
};

/** Next route after auth gates, honoring a deferred deep link when present. */
export function getPostAuthRoute(
  user: User,
  rc: RevenueCatGate,
  pendingDeepLink: ParsedDeepLink | null,
): Href | null {
  if (!user.isEmailVerified) return "/(auth)/verify" as Href;

  if (isStaffUser(user)) {
    if (!user.onboardingComplete) return "/onboarding" as Href;
    return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
  }

  // Hard paywall: route from auth + customer info; catalog loads in background on paywall.
  if (rc.enabled) {
    if (!rc.isReady) return null;
    if (!rc.isEntitled) return "/(paywall)" as Href;
  }

  if (!user.onboardingComplete) return "/onboarding" as Href;

  return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
}

export const HARD_PAYWALL_ROUTE = "/(paywall)";

/**
 * Whether a resolved post-auth route is the hard subscription paywall.
 * The welcome screen uses this to render a signed-in "gated" state instead of
 * passively shoving the user onto the paywall (which would make Back ping-pong).
 */
export function isHardPaywallRoute(route: Href | null | undefined): boolean {
  return route != null && String(route) === HARD_PAYWALL_ROUTE;
}

function isAuthGateRoute(route: Href): boolean {
  const path = String(route);
  return (
    path.startsWith("/(auth)/verify") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/(paywall)")
  );
}

/** Resolve post-auth route and clear any consumed deferred deep link. Returns null while RC SDK init is in progress. */
export function resolvePostAuthNavigation(
  user: User,
  rc: RevenueCatGate,
  pendingDeepLink: ParsedDeepLink | null,
  consumePendingHref: () => string | null,
): Href | null {
  const route = getPostAuthRoute(user, rc, pendingDeepLink);
  if (!route) return null;
  if (!isAuthGateRoute(route) && pendingDeepLink) {
    consumePendingHref();
  }
  return route;
}
