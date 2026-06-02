import { Redirect, usePathname, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
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
  applyDeferredNotificationHref,
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
  const { pendingDeepLink, consumePendingHref, hydrated: deepLinkHydrated } =
    usePendingDeepLink();
  const [deferredEpoch, setDeferredEpoch] = useState(getDeferredNavigationEpoch);

  const needsGate = userNeedsEntitlementGate(user, rc, pathname, segments);
  const gateLoading = entitlementGateIsLoading(user, rc, pathname, segments);

  useEffect(() => subscribeDeferredNavigation(() => setDeferredEpoch(getDeferredNavigationEpoch())), []);

  useEffect(() => {
    if (authLoading || !user?.isEmailVerified) return;
    if (!deepLinkHydrated) return;
    if (gateLoading || needsGate) return;

    const deepHref = pendingDeepLink ? consumePendingHref() : null;
    const notifHref = deepHref ? null : consumePendingNotificationHref();
    const href = deepHref ?? notifHref;
    if (!href) return;

    applyDeferredNotificationHref(href, pathname);
  }, [
    authLoading,
    user?.id,
    user?.isEmailVerified,
    deepLinkHydrated,
    gateLoading,
    needsGate,
    rc.isEntitled,
    pathname,
    pendingDeepLink,
    deferredEpoch,
    consumePendingHref,
  ]);

  if (authLoading) {
    return <>{children}</>;
  }

  if (gateLoading) {
    return <AppLoadingScreen variant="splash" />;
  }

  if (needsGate) {
    return <Redirect href="/(paywall)" />;
  }

  return <>{children}</>;
}
