import { Redirect, router, usePathname, useSegments, type Href } from "expo-router";
import React, { useEffect, useRef } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import {
  entitlementGateIsLoading,
  userNeedsEntitlementGate,
} from "@/lib/entitlementGate";
import { consumePendingNotificationHref } from "@/lib/notificationNavigation";

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
  const consumedNotificationRef = useRef(false);

  const needsGate = userNeedsEntitlementGate(user, rc, pathname, segments);
  const gateLoading = entitlementGateIsLoading(user, rc, pathname, segments);

  useEffect(() => {
    consumedNotificationRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.isEmailVerified) return;
    if (gateLoading || needsGate) return;
    if (consumedNotificationRef.current) return;

    const href = consumePendingNotificationHref();
    if (!href) return;

    consumedNotificationRef.current = true;
    router.replace(href as Href);
  }, [authLoading, user?.id, user?.isEmailVerified, gateLoading, needsGate, rc.isEntitled]);

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
