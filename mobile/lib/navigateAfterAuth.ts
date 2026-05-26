import type { Href } from "expo-router";
import type { User } from "@workspace/api-client-react";
import type { ParsedDeepLink } from "@/lib/parseDeepLink";
import { deepLinkToHref } from "@/lib/parseDeepLink";

type RevenueCatGate = {
  isReady: boolean;
  enabled: boolean;
  isEntitled: boolean;
};

function isStaff(user: User): boolean {
  return user.role === "admin" || user.role === "moderator";
}

/** Next route after auth gates, honoring a deferred deep link when present. */
export function getPostAuthRoute(
  user: User,
  rc: RevenueCatGate,
  pendingDeepLink: ParsedDeepLink | null,
): Href | null {
  if (!user.isEmailVerified) return "/(auth)/verify" as Href;

  if (isStaff(user)) {
    if (!user.onboardingComplete) return "/onboarding" as Href;
    return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
  }

  // Hard paywall: must start the store trial / subscription before app access.
  if (rc.enabled) {
    if (!rc.isReady) return null;
    if (!rc.isEntitled) return "/(paywall)" as Href;
  }

  if (!user.onboardingComplete) return "/onboarding" as Href;

  return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
}

function isAuthGateRoute(route: Href): boolean {
  const path = String(route);
  return (
    path.startsWith("/(auth)/verify") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/(paywall)")
  );
}

/** Resolve post-auth route and clear any consumed deferred deep link. */
export function resolvePostAuthNavigation(
  user: User,
  rc: RevenueCatGate,
  pendingDeepLink: ParsedDeepLink | null,
  consumePendingHref: () => string | null,
): Href {
  const route = getPostAuthRoute(user, rc, pendingDeepLink);
  if (!route) return "/(tabs)" as Href;
  if (!isAuthGateRoute(route) && pendingDeepLink) {
    consumePendingHref();
  }
  return route;
}
