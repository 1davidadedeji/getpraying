import { router, type Href } from "expo-router";

/**
 * Single authority for executing a post-authentication redirect.
 *
 * Several independent surfaces resolve and perform the same redirect after
 * auth/entitlement changes (welcome screen, login, register, verify,
 * onboarding, paywall). When two fire within a frame or two, the result is a
 * flicker or a redirect that "loses" to a competing one. Routing every
 * post-auth `router.replace` through here de-dupes identical targets fired in a
 * short window, so the *destination* is decided once.
 *
 * The decision of WHICH route to go to still lives in
 * `lib/navigateAfterAuth.ts` (`resolvePostAuthNavigation`/`getPostAuthRoute`).
 * This module only owns EXECUTION. Distinct routes are never dropped.
 */
const DEDUPE_WINDOW_MS = 1000;

let lastRoute: string | null = null;
let lastAt = 0;

/** Pure dedupe decision (exported for tests). */
export function shouldDedupePostAuthNavigation(
  prevRoute: string | null,
  prevAt: number,
  nextRoute: string,
  now: number,
  windowMs: number = DEDUPE_WINDOW_MS,
): boolean {
  return prevRoute === nextRoute && now - prevAt < windowMs;
}

export function navigatePostAuth(route: Href): void {
  const key = typeof route === "string" ? route : JSON.stringify(route);
  const now = Date.now();
  if (shouldDedupePostAuthNavigation(lastRoute, lastAt, key, now)) return;
  lastRoute = key;
  lastAt = now;
  router.replace(route);
}

/** Test-only: clear the dedupe window. */
export function __resetPostAuthNavigator(): void {
  lastRoute = null;
  lastAt = 0;
}
