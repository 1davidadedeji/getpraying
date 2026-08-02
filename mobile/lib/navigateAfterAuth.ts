import type { Href } from "expo-router";
import type { User } from "@workspace/api-client-react";
import type { ParsedDeepLink } from "@/lib/parseDeepLink";
import { deepLinkToHref } from "@/lib/parseDeepLink";
import { isStaffUser } from "@/lib/staffAccess";

/** @deprecated Hard paywall removed — paywall is soft-only. Kept for test compatibility. */
export const HARD_PAYWALL_ROUTE = "/(paywall)";

/**
 * @deprecated Freemium model — post-auth never routes to a mandatory paywall.
 */
export function isHardPaywallRoute(route: Href | null | undefined): boolean {
  return false;
}

/** Next route after auth gates, honoring a deferred deep link when present. */
export function getPostAuthRoute(
  user: User,
  _rc: unknown,
  pendingDeepLink: ParsedDeepLink | null,
): Href | null {
  if (!user.isEmailVerified) return "/(auth)/verify" as Href;

  if (isStaffUser(user)) {
    if (!user.onboardingComplete) return "/onboarding" as Href;
    return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
  }

  if (!user.onboardingComplete) return "/onboarding" as Href;

  return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
}

function isAuthGateRoute(route: Href): boolean {
  const path = String(route);
  return path.startsWith("/(auth)/verify") || path.startsWith("/onboarding");
}

/** Resolve post-auth route and clear any consumed deferred deep link. */
export function resolvePostAuthNavigation(
  user: User,
  rc: unknown,
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
