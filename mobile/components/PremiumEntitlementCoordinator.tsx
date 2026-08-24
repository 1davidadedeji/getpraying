import React, { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { clearAudioMediaCache } from "@/lib/audioMediaCache";
import { setLibraryFetchEntitlement } from "@/lib/libraryFetchCache";
import { isSubscribed } from "@/lib/subscriptionAccess";

/**
 * Clears premium library/audio caches when entitlement changes so unsubscribed
 * viewers cannot replay stripped content from stale in-memory or disk cache.
 */
export function PremiumEntitlementCoordinator() {
  const { user } = useAuth();
  const rc = useRevenueCat();
  const subscribed = isSubscribed(user, rc);
  const prevRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevRef.current === subscribed) return;
    prevRef.current = subscribed;
    setLibraryFetchEntitlement(subscribed);
    if (!subscribed) {
      void clearAudioMediaCache();
    }
  }, [subscribed]);

  return null;
}
