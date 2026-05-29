import { Platform } from "react-native";
import type {
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";

/** Must match the Offering identifier in the RevenueCat dashboard. */
export const DEFAULT_OFFERING_ID = "default";

function configuredOfferingId(): string | null {
  const id = process.env.EXPO_PUBLIC_RC_OFFERING_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/** Optional direct store product id when RC offerings are slow or misconfigured. */
export function getConfiguredStoreProductId(): string | null {
  const { Platform: RNPlatform } = require("react-native");
  const ios =
    process.env.EXPO_PUBLIC_RC_IOS_PRODUCT_ID?.trim() ??
    process.env.EXPO_PUBLIC_RC_APPLE_PRODUCT_ID?.trim() ??
    process.env.EXPO_PUBLIC_RC_MONTHLY_PRODUCT_ID?.trim() ??
    "";
  const android =
    process.env.EXPO_PUBLIC_RC_ANDROID_PRODUCT_ID?.trim() ??
    process.env.EXPO_PUBLIC_RC_GOOGLE_PRODUCT_ID?.trim() ??
    process.env.EXPO_PUBLIC_RC_MONTHLY_PRODUCT_ID?.trim() ??
    "";
  const id = RNPlatform.OS === "ios" ? ios : android;
  return id.length > 0 ? id : null;
}

type Offering = NonNullable<PurchasesOfferings["current"]>;

/** Every offering from RevenueCat, current + configured id + default + all others. */
export function listOfferings(offerings: PurchasesOfferings | null | undefined): Offering[] {
  if (!offerings) return [];
  const out: Offering[] = [];
  const seen = new Set<string>();

  const push = (o: Offering | null | undefined) => {
    if (!o || seen.has(o.identifier)) return;
    seen.add(o.identifier);
    out.push(o);
  };

  push(offerings.current);
  push(offerings.all?.[configuredOfferingId() ?? ""]);
  push(offerings.all?.[DEFAULT_OFFERING_ID]);
  for (const o of Object.values(offerings.all ?? {})) {
    push(o);
  }
  return out;
}

function pickPackageFromOffering(offering: Offering): PurchasesPackage | null {
  return (
    offering.monthly ??
    offering.availablePackages.find((p) => p.packageType === "MONTHLY") ??
    offering.availablePackages.find((p) => /month/i.test(p.identifier)) ??
    offering.availablePackages.find((p) => /month/i.test(p.product.identifier)) ??
    offering.availablePackages[0] ??
    null
  );
}

export function getMonthlyPackage(
  offerings: PurchasesOfferings | null | undefined,
): PurchasesPackage | null {
  for (const offering of listOfferings(offerings)) {
    const pkg = pickPackageFromOffering(offering);
    if (pkg) return pkg;
  }
  return null;
}

export function getMonthlyProduct(
  monthlyPackage: PurchasesPackage | null,
  storeProduct: PurchasesStoreProduct | null,
): PurchasesStoreProduct | null {
  return monthlyPackage?.product ?? storeProduct ?? null;
}

export type SubscriptionCatalog = {
  offerings: PurchasesOfferings | null;
  monthlyPackage: PurchasesPackage | null;
  storeProduct: PurchasesStoreProduct | null;
  error: string | null;
};

type PurchasesModule = {
  getOfferings: () => Promise<PurchasesOfferings>;
  getProducts: (productIds: string[]) => Promise<PurchasesStoreProduct[]>;
  getCustomerInfo: () => Promise<import("react-native-purchases").CustomerInfo>;
  LOG_LEVEL?: { DEBUG: string };
  setLogLevel?: (level: string) => void;
};

/** Load RC offerings, then fall back to a direct Play/App Store product id if needed. */
export async function fetchSubscriptionCatalog(
  Purchases: PurchasesModule,
): Promise<SubscriptionCatalog> {
  if (__DEV__ && Purchases.setLogLevel && Purchases.LOG_LEVEL?.DEBUG) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }

  let offerings: PurchasesOfferings | null = null;
  let error: string | null = null;

  try {
    offerings = await Purchases.getOfferings();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load subscription plans";
    console.warn("[revenuecat] getOfferings failed:", e);
  }

  let monthlyPackage = getMonthlyPackage(offerings);
  let storeProduct: PurchasesStoreProduct | null = null;

  if (!monthlyPackage) {
    const productId = getConfiguredStoreProductId();
    if (productId) {
      try {
        const products = await Purchases.getProducts([productId]);
        storeProduct = products.find((p) => p.identifier === productId) ?? products[0] ?? null;
        if (!storeProduct && !error) {
          error = `Store product "${productId}" was not returned by ${Platform.OS === "ios" ? "App Store" : "Google Play"}.`;
        }
      } catch (e) {
        console.warn("[revenuecat] getProducts failed:", e);
        if (!error) {
          error = e instanceof Error ? e.message : "Could not load store product";
        }
      }
    } else if (!error && listOfferings(offerings).length === 0) {
      error = "No RevenueCat offerings returned. Check that a Current Offering is set in the dashboard.";
    } else if (!error) {
      error = "No monthly package found in RevenueCat offerings.";
    }
  }

  if (monthlyPackage || storeProduct) {
    error = null;
  }

  return { offerings, monthlyPackage, storeProduct, error };
}
