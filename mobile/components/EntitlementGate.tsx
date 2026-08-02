import { usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth";
import { usePendingDeepLink } from "@/context/pendingDeepLink";
import {
  getDeferredNavigationEpoch,
  subscribeDeferredNavigation,
} from "@/lib/deferredNavigation";
import { deferredNavigationReady } from "@/lib/entitlementGate";
import {
  consumePendingNotificationHref,
  applyNotificationHref,
} from "@/lib/notificationNavigation";

/**
 * Applies deferred deep links and push notification targets once auth is ready.
 * Freemium: does not block routes — premium access is enforced per content item.
 */
export function EntitlementGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const { pendingDeepLink, consumePendingHref, hydrated: deepLinkHydrated } =
    usePendingDeepLink();
  const [deferredEpoch, setDeferredEpoch] = useState(getDeferredNavigationEpoch);

  const navReady = deferredNavigationReady(user, authLoading);

  useEffect(() => subscribeDeferredNavigation(() => setDeferredEpoch(getDeferredNavigationEpoch())), []);

  useEffect(() => {
    if (!navReady || !deepLinkHydrated) return;

    const deepHref = pendingDeepLink ? consumePendingHref() : null;
    const notifHref = deepHref ? null : consumePendingNotificationHref();
    const href = deepHref ?? notifHref;
    if (!href) return;

    applyNotificationHref(href, pathnameRef.current);
  }, [
    navReady,
    deepLinkHydrated,
    pendingDeepLink,
    deferredEpoch,
    consumePendingHref,
  ]);

  return <>{children}</>;
}
