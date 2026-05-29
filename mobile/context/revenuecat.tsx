import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import { useAuth } from "@/context/auth";
import {
  canUseBoostFeature,
  hasPremiumEntitlement,
  isPremiumTrialPeriod,
  PREMIUM_ENTITLEMENT_ID,
} from "@/lib/revenuecatEntitlements";
import {
  DEFAULT_OFFERING_ID,
  fetchSubscriptionCatalog,
  getConfiguredStoreProductId,
  getMonthlyPackage,
  getMonthlyProduct,
} from "@/lib/revenuecatCatalog";
import { isStaffUser } from "@/lib/staffAccess";

export { DEFAULT_OFFERING_ID, PREMIUM_ENTITLEMENT_ID };

export function getDefaultOffering(
  offerings: PurchasesOfferings | null | undefined,
): PurchasesOfferings["current"] {
  if (!offerings) return null;
  return offerings.current ?? offerings.all?.[DEFAULT_OFFERING_ID] ?? null;
}

export { getMonthlyPackage };

type RevenueCatState = {
  enabled: boolean;
  isReady: boolean;
  catalogLoading: boolean;
  catalogError: string | null;
  offerings: PurchasesOfferings | null;
  monthlyPackage: PurchasesPackage | null;
  monthlyStoreProduct: PurchasesStoreProduct | null;
  monthlyProduct: PurchasesStoreProduct | null;
  hasMonthlyOffer: boolean;
  customerInfo: CustomerInfo | null;
  isEntitled: boolean;
  isPremiumTrial: boolean;
  canUseBoost: boolean;
  refresh: () => Promise<void>;
  purchaseMonthly: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<CustomerInfo>;
  upgradeFromTrial: () => Promise<void>;
};

const RevenueCatContext = createContext<RevenueCatState | null>(null);

/** Load native module only when needed — avoids eager init at bundle parse (release crash risk with billing SDK). */
function getPurchases() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-purchases").default;
}

function getRevenueCatApiKey(): string {
  const { Platform } = require("react-native");
  const iosKey =
    process.env.EXPO_PUBLIC_RC_IOS_KEY ??
    process.env.EXPO_PUBLIC_RC_APPLE_KEY ??
    "";
  const androidKey =
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY ??
    process.env.EXPO_PUBLIC_RC_GOOGLE_KEY ??
    "";
  return Platform.OS === "ios" ? iosKey : androidKey;
}

/** Tie purchases to the signed-in account so restore works across devices. */
function RevenueCatUserSync({
  enabled,
  onCustomerInfo,
  onUserLinked,
}: {
  enabled: boolean;
  onCustomerInfo: (info: CustomerInfo | null) => void;
  onUserLinked: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [linkedUserId, setLinkedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (user?.id) return;

    setLinkedUserId(null);
    (async () => {
      try {
        const Purchases = getPurchases();
        const info = await Purchases.logOut();
        onCustomerInfo(info);
      } catch {
        onCustomerInfo(null);
      }
    })();
  }, [enabled, user?.id, onCustomerInfo]);

  useEffect(() => {
    (async () => {
      if (!enabled || !user?.id) return;
      if (linkedUserId === user.id) return;
      try {
        const Purchases = getPurchases();
        const { customerInfo: info } = await Purchases.logIn(String(user.id));
        onCustomerInfo(info);
        setLinkedUserId(user.id);
        await onUserLinked();
      } catch {
        /* ignore — anonymous customer still works for new purchases */
      }
    })();
  }, [enabled, user?.id, linkedUserId, onCustomerInfo, onUserLinked]);

  return null;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const staffBypass = isStaffUser(user);
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [monthlyStoreProduct, setMonthlyStoreProduct] = useState<PurchasesStoreProduct | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!enabled) return;
    const Purchases = getPurchases();
    setCatalogLoading(true);
    try {
      const catalog = await fetchSubscriptionCatalog(Purchases);
      setOfferings(catalog.offerings);
      setMonthlyStoreProduct(catalog.storeProduct);
      setCatalogError(catalog.error);
      if (__DEV__) {
        const offeringIds = catalog.offerings
          ? Object.keys(catalog.offerings.all ?? {})
          : [];
        console.info("[revenuecat] catalog", {
          offeringIds,
          current: catalog.offerings?.current?.identifier ?? null,
          monthlyPackage: catalog.monthlyPackage?.identifier ?? null,
          storeProduct: catalog.storeProduct?.identifier ?? null,
          configuredProductId: getConfiguredStoreProductId(),
          error: catalog.error,
        });
      }
    } finally {
      setCatalogLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    (async () => {
      try {
        const apiKey = getRevenueCatApiKey();

        if (!apiKey) {
          setEnabled(false);
          setIsReady(true);
          return;
        }

        const Purchases = getPurchases();
        await Purchases.configure({ apiKey });
        setEnabled(true);

        try {
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
        } catch {
          /* ignore */
        }

        const catalog = await fetchSubscriptionCatalog(Purchases);
        setOfferings(catalog.offerings);
        setMonthlyStoreProduct(catalog.storeProduct);
        setCatalogError(catalog.error);
      } catch (e) {
        console.warn("[revenuecat] configure failed:", e);
        setEnabled(false);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const Purchases = getPurchases();
    setCatalogLoading(true);
    try {
      const [catalog, info] = await Promise.all([
        fetchSubscriptionCatalog(Purchases),
        Purchases.getCustomerInfo(),
      ]);
      setOfferings(catalog.offerings);
      setMonthlyStoreProduct(catalog.storeProduct);
      setCatalogError(catalog.error);
      setCustomerInfo(info);
    } finally {
      setCatalogLoading(false);
    }
  }, [enabled]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(info);
    if (!hasPremiumEntitlement(info)) {
      throw new Error("Purchase completed but premium access was not activated.");
    }
  }, [enabled]);

  const purchaseMonthly = useCallback(async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const pkg = getMonthlyPackage(offerings);
    if (pkg) {
      await purchasePackage(pkg);
      return;
    }
    if (monthlyStoreProduct) {
      const Purchases = getPurchases();
      const { customerInfo: info } = await Purchases.purchaseStoreProduct(monthlyStoreProduct);
      setCustomerInfo(info);
      if (!hasPremiumEntitlement(info)) {
        throw new Error("Purchase completed but premium access was not activated.");
      }
      return;
    }
    throw new Error("Subscription is not available right now. Try again in a moment.");
  }, [enabled, offerings, monthlyStoreProduct, purchasePackage]);

  const restore = useCallback(async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return info;
  }, [enabled]);

  const upgradeFromTrial = useCallback(async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const pkg = getMonthlyPackage(offerings);
    if (pkg) {
      await purchasePackage(pkg);
      return;
    }
    if (monthlyStoreProduct) {
      await purchaseMonthly();
      return;
    }
    const url = customerInfo?.managementURL;
    if (url) {
      await Linking.openURL(url);
      return;
    }
    throw new Error("Subscription options are not available right now.");
  }, [enabled, offerings, monthlyStoreProduct, customerInfo?.managementURL, purchasePackage, purchaseMonthly]);

  const monthlyPackage = useMemo(() => getMonthlyPackage(offerings), [offerings]);
  const monthlyProduct = useMemo(
    () => getMonthlyProduct(monthlyPackage, monthlyStoreProduct),
    [monthlyPackage, monthlyStoreProduct],
  );
  const hasMonthlyOffer = !!(monthlyPackage || monthlyStoreProduct);

  const isEntitled = staffBypass || (enabled ? hasPremiumEntitlement(customerInfo) : false);
  const isPremiumTrial =
    !staffBypass && enabled ? isPremiumTrialPeriod(customerInfo) : false;
  const canUseBoost = staffBypass || (enabled ? canUseBoostFeature(customerInfo) : false);

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      catalogLoading,
      catalogError,
      offerings,
      monthlyPackage,
      monthlyStoreProduct,
      monthlyProduct,
      hasMonthlyOffer,
      customerInfo,
      isEntitled,
      isPremiumTrial,
      canUseBoost,
      refresh,
      purchaseMonthly,
      purchasePackage,
      restore,
      upgradeFromTrial,
    }),
    [
      enabled,
      isReady,
      catalogLoading,
      catalogError,
      offerings,
      monthlyPackage,
      monthlyStoreProduct,
      monthlyProduct,
      hasMonthlyOffer,
      customerInfo,
      isEntitled,
      isPremiumTrial,
      canUseBoost,
      refresh,
      purchaseMonthly,
      purchasePackage,
      restore,
      upgradeFromTrial,
    ],
  );

  return (
    <RevenueCatContext.Provider value={value}>
      <RevenueCatUserSync
        enabled={enabled}
        onCustomerInfo={setCustomerInfo}
        onUserLinked={loadCatalog}
      />
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatState {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    return {
      enabled: false,
      isReady: true,
      catalogLoading: false,
      catalogError: null,
      offerings: null,
      monthlyPackage: null,
      monthlyStoreProduct: null,
      monthlyProduct: null,
      hasMonthlyOffer: false,
      customerInfo: null,
      isEntitled: false,
      isPremiumTrial: false,
      canUseBoost: false,
      refresh: async () => {},
      purchaseMonthly: async () => {
        throw new Error("RevenueCatProvider missing");
      },
      purchasePackage: async () => {
        throw new Error("RevenueCatProvider missing");
      },
      restore: async () => {
        throw new Error("RevenueCatProvider missing");
      },
      upgradeFromTrial: async () => {
        throw new Error("RevenueCatProvider missing");
      },
    };
  }
  return ctx;
}
