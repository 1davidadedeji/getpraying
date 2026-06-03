import { Redirect, usePathname, useSegments } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { useAuth } from "@/context/auth";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import { useRevenueCat } from "@/context/revenuecat";
import {
  getDeferredNavigationEpoch,
  subscribeDeferredNavigation,
} from "@/lib/deferredNavigation";
import {
  entitlementGateIsLoading,
  userNeedsEntitlementGate,
} from "@/lib/entitlementGate";
import {
  consumePendingNotificationHref,
  applyNotificationHref,
} from "@/lib/notificationNavigation";

/**
 * Root-stack paywall guard: blocks deep links and push targets (e.g. `/post/:id`)
 * until RevenueCat entitlement is confirmed. Exempt routes: auth, paywall,
 * onboarding, settings.
 */
export function EntitlementGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const rc = useRevenueCat();
  const pathname = usePathname();
  const segments = useSegments();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const { pendingDeepLink, consumePendingHref, hydrated: deepLinkHydrated } =
    usePendingDeepLink();
  const [deferredEpoch, setDeferredEpoch] = useState(getDeferredNavigationEpoch);

  const needsGate = userNeedsEntitlementGate(user, rc, pathname, segments);
  const gateLoading = entitlementGateIsLoading(user, rc, pathname, segments);
  const gateOpen = !authLoading && Boolean(user?.isEmailVerified) && !gateLoading && !needsGate;

  useEffect(() => subscribeDeferredNavigation(() => setDeferredEpoch(getDeferredNavigationEpoch())), []);

  useEffect(() => {
    if (!gateOpen || !deepLinkHydrated) return;

    const deepHref = pendingDeepLink ? consumePendingHref() : null;
    const notifHref = deepHref ? null : consumePendingNotificationHref();
    const href = deepHref ?? notifHref;
    if (!href) return;

    applyNotificationHref(href, pathnameRef.current);
  }, [
    gateOpen,
    deepLinkHydrated,
    pendingDeepLink,
    deferredEpoch,
    consumePendingHref,
  ]);

  if (authLoading) {
    return <>{children}</>;
  }

  // Only block UI for users who still need the paywall — not during background RC checks for subscribers.
  if (gateLoading && needsGate) {
    return <AppLoadingScreen variant="splash" />;
  }

  if (needsGate) {
    return <Redirect href="/(paywall)" />;
  }

  return <>{children}</>;
}
