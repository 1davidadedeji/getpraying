import { router, type Href } from "expo-router";

export type PaywallSource = "settings" | "premiumContent" | "boost" | "generic";

/** Open the soft paywall; source only affects post-purchase side effects (e.g. premium auto-play). */
export function openPremiumPaywall(source: PaywallSource = "generic"): void {
  const params = new URLSearchParams({ soft: "1" });
  if (source !== "generic") params.set("source", source);
  router.push(`/(paywall)?${params.toString()}` as Href);
}
