import { router, type Href } from "expo-router";

export type PaywallSource = "settings" | "premiumContent" | "boost" | "generic";

/** Open the soft paywall; source controls back/dismiss behavior and headline context. */
export function openPremiumPaywall(source: PaywallSource = "generic"): void {
  const params = new URLSearchParams({ soft: "1" });
  if (source !== "generic") params.set("source", source);
  router.push(`/(paywall)?${params.toString()}` as Href);
}
