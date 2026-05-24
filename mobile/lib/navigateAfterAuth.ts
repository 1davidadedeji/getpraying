import type { Href } from "expo-router";
import type { User } from "@workspace/api-client-react";
import { isTrialExpired } from "@/lib/trial";
import type { ParsedDeepLink } from "@/lib/parseDeepLink";
import { deepLinkToHref } from "@/lib/parseDeepLink";

type RevenueCatGate = {
  isReady: boolean;
  enabled: boolean;
  isEntitled: boolean;
};

/** Next route after auth gates, honoring a deferred deep link when present. */
export function getPostAuthRoute(
  user: User,
  rc: RevenueCatGate,
  pendingDeepLink: ParsedDeepLink | null,
): Href {
  if (!user.isEmailVerified) return "/(auth)/verify" as Href;

  if (user.role === "admin" || user.role === "moderator") {
    if (!user.onboardingComplete) return "/onboarding" as Href;
    return (pendingDeepLink ? deepLinkToHref(pendingDeepLink) : "/(tabs)") as Href;
  }

  const trialExpired = isTrialExpired(user.trialStartsAt);
  if (trialExpired && rc.isReady && rc.enabled && !rc.isEntitled) {
    return "/(paywall)" as Href;
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
  if (!isAuthGateRoute(route) && pendingDeepLink) {
    consumePendingHref();
  }
  return route;
}
