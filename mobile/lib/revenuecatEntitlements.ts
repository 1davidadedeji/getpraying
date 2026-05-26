import type { CustomerInfo, PurchasesStoreProduct } from "react-native-purchases";

/** Must match the Entitlement identifier in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = "premium";

export function getPremiumEntitlement(info: CustomerInfo | null | undefined) {
  return info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID] ?? null;
}

export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  return Boolean(getPremiumEntitlement(info));
}

/** Active premium entitlement currently in a store free trial or intro period. */
export function isPremiumTrialPeriod(info: CustomerInfo | null | undefined): boolean {
  const ent = getPremiumEntitlement(info);
  if (!ent) return false;
  const periodType = String(ent.periodType ?? "").toUpperCase();
  return periodType === "TRIAL" || periodType === "INTRO";
}

/** Boost is reserved for fully paid subscribers — not RC trial / intro periods. */
export function canUseBoostFeature(info: CustomerInfo | null | undefined): boolean {
  return hasPremiumEntitlement(info) && !isPremiumTrialPeriod(info);
}

/** Apple-compliant trial line for the paywall CTA. */
export function formatMonthlyTrialOffer(product: PurchasesStoreProduct | null | undefined): string {
  const price = product?.priceString ?? "$6.99";
  const intro = product?.introPrice;
  if (intro?.priceString && intro.price === 0) {
    const unit = introPeriodLabel(intro.periodUnit, intro.periodNumberOfUnits);
    if (unit) return `${unit} Free, then ${price}/month`;
  }
  if (intro?.priceString && intro.period) {
    return `${intro.priceString} intro, then ${price}/month`;
  }
  return `7 Days Free, then ${price}/month`;
}

function introPeriodLabel(
  unit: string | number | null | undefined,
  count: number | null | undefined,
): string | null {
  const n = count ?? 0;
  const u = String(unit ?? "").toUpperCase();
  if (n <= 0) return "7 Days";
  if (u.includes("DAY")) return n === 1 ? "1 Day" : `${n} Days`;
  if (u.includes("WEEK")) return n === 1 ? "7 Days" : `${n} Weeks`;
  if (u.includes("MONTH")) return n === 1 ? "1 Month" : `${n} Months`;
  return null;
}
