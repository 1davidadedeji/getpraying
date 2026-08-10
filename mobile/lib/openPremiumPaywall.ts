import { router, type Href } from "expo-router";

const PREMIUM_PAYWALL_HREF = "/(paywall)?soft=1" as Href;

/** Open the soft paywall for premium content upsells. */
export function openPremiumPaywall(): void {
  router.push(PREMIUM_PAYWALL_HREF);
}
