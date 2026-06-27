import type { CustomerInfo, PurchasesStoreProduct } from "react-native-purchases";

/** Must match the Entitlement identifier in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = "premium";

export function getPremiumEntitlement(info: CustomerInfo | null | undefined) {
  return info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID] ?? null;
}

export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  return Boolean(getPremiumEntitlement(info));
}

/**
 * The store detected a billing problem (e.g. insufficient funds) on the active
 * premium entitlement. During this grace/retry window the user KEEPS access —
 * the store retries the charge and only revokes (via an EXPIRATION webhook) if it
 * ultimately fails. Use this to nudge the user to fix their payment method.
 */
export function hasBillingIssue(info: CustomerInfo | null | undefined): boolean {
  const ent = getPremiumEntitlement(info);
  return Boolean(ent?.billingIssueDetectedAt);
}

/** The store detection timestamp (string) — stable key for de-duping nudges. */
export function billingIssueDetectedAt(info: CustomerInfo | null | undefined): string | null {
  const ent = getPremiumEntitlement(info);
  return ent?.billingIssueDetectedAt ?? null;
}

/** Active premium entitlement currently in a store free trial or intro period. */
export function isPremiumTrialPeriod(info: CustomerInfo | null | undefined): boolean {
  const ent = getPremiumEntitlement(info);
  if (!ent) return false;
  const periodType = String(ent.periodType ?? "").toUpperCase();
  if (periodType === "TRIAL" || periodType === "INTRO") return true;
  // Sandbox / older SDK payloads sometimes omit periodType during an active trial.
  if (!periodType && ent.willRenew === true && ent.isActive) {
    const productId = String(ent.productIdentifier ?? "").toLowerCase();
    if (productId.includes("trial")) return true;
  }
  return false;
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
