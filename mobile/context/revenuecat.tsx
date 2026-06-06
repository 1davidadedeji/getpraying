import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import { useAuth } from "@/context/auth";
import {
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
import { isServerBoostEligible, isServerPaidPremium } from "@/lib/serverSubscription";
import type { SubscriptionCatalog } from "@/lib/revenuecatCatalog";

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
  /** True while SDK configure + initial customer info is in progress (not catalog/StoreKit offerings). */
  isCheckingSubscription: boolean;
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
  refresh: () => Promise<CustomerInfo | null>;
  purchaseMonthly: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<CustomerInfo>;
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

/** Tie purchases to the signed-in account so restore works across devices. Non-blocking. */
function RevenueCatUserSync({
  enabled,
  onCustomerInfo,
  onUserLinked,
}: {
  enabled: boolean;
  onCustomerInfo: (info: CustomerInfo | null) => void;
  /** Fire-and-forget catalog refresh after account link (must not block navigation). */
  onUserLinked?: () => void;
}) {
  const { user } = useAuth();
  const [linkedUserId, setLinkedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || user?.id) return;

    setLinkedUserId(null);
    void (async () => {
      try {
        const Purchases = getPurchases();
        const isAnonymous = await Purchases.isAnonymous();
        if (isAnonymous) {
          onCustomerInfo(await Purchases.getCustomerInfo());
        } else {
          const info = await Purchases.logOut();
          onCustomerInfo(info);
        }
      } catch {
        onCustomerInfo(null);
      }
    })();
  }, [enabled, user?.id, onCustomerInfo]);

  useEffect(() => {
    if (!enabled || !user?.id || linkedUserId === user.id) return;

    void (async () => {
      try {
        const Purchases = getPurchases();
        const { customerInfo: info } = await Purchases.logIn(String(user.id));
        onCustomerInfo(info);
        setLinkedUserId(user.id);
        onUserLinked?.();
      } catch {
        /* ignore — anonymous customer still works for new purchases */
      }
    })();
  }, [enabled, user?.id, linkedUserId, onCustomerInfo, onUserLinked]);

  return null;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUserFromServer } = useAuth();
  const staffBypass = isStaffUser(user);
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [monthlyStoreProduct, setMonthlyStoreProduct] = useState<PurchasesStoreProduct | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  /** Set immediately after a successful purchase while RC receipt validation may still lag. */
  const [optimisticEntitlement, setOptimisticEntitlement] = useState(false);

  const applyCustomerInfo = useCallback(
    (info: CustomerInfo | null) => {
      setCustomerInfo(info);
      if (hasPremiumEntitlement(info)) {
        setOptimisticEntitlement(false);
        void refreshUserFromServer();
      }
    },
    [refreshUserFromServer],
  );

  useEffect(() => {
    if (!user?.id) {
      setOptimisticEntitlement(false);
    }
  }, [user?.id]);

  const isCheckingSubscription = !isReady;

  const applyCatalog = useCallback((catalog: SubscriptionCatalog) => {
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
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!enabled) return;
    const Purchases = getPurchases();
    setCatalogLoading(true);
    try {
      const catalog = await fetchSubscriptionCatalog(Purchases);
      applyCatalog(catalog);
    } finally {
      setCatalogLoading(false);
    }
  }, [enabled, applyCatalog]);

  useEffect(() => {
    let removeListener: (() => void) | undefined;

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

        removeListener = Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);

        try {
          const info = await Purchases.getCustomerInfo();
          applyCustomerInfo(info);
        } catch {
          /* ignore */
        }

        setIsReady(true);

        void (async () => {
          setCatalogLoading(true);
          try {
            applyCatalog(await fetchSubscriptionCatalog(Purchases));
          } finally {
            setCatalogLoading(false);
          }
        })();
      } catch (e) {
        console.warn("[revenuecat] configure failed:", e);
        setEnabled(false);
        setIsReady(true);
      }
    })();

    return () => {
      removeListener?.();
    };
  }, [applyCustomerInfo, applyCatalog]);

  const refresh = useCallback(async (): Promise<CustomerInfo | null> => {
    if (!enabled) return null;
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
      applyCustomerInfo(info);
      void refreshUserFromServer();
      return info;
    } finally {
      setCatalogLoading(false);
    }
  }, [enabled, applyCustomerInfo, refreshUserFromServer]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    setOptimisticEntitlement(true);
    applyCustomerInfo(info);
    void refreshUserFromServer();
  }, [enabled, applyCustomerInfo, refreshUserFromServer]);

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
      setOptimisticEntitlement(true);
      applyCustomerInfo(info);
      void refreshUserFromServer();
      return;
    }
    throw new Error("Subscription is not available right now. Try again in a moment.");
  }, [enabled, offerings, monthlyStoreProduct, purchasePackage, applyCustomerInfo, refreshUserFromServer]);

  const restore = useCallback(async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    void refreshUserFromServer();
    return info;
  }, [enabled, applyCustomerInfo, refreshUserFromServer]);

  const monthlyPackage = useMemo(() => getMonthlyPackage(offerings), [offerings]);
  const monthlyProduct = useMemo(
    () => getMonthlyProduct(monthlyPackage, monthlyStoreProduct),
    [monthlyPackage, monthlyStoreProduct],
  );
  const hasMonthlyOffer = !!(monthlyPackage || monthlyStoreProduct);

  const adminBoostBypass = user?.role === "admin";
  const serverBoostEligible = isServerBoostEligible(user);
  const confirmedEntitled = enabled ? hasPremiumEntitlement(customerInfo) : false;
  const serverEntitled = isServerPaidPremium(user?.subscription);
  const isEntitled =
    staffBypass ||
    serverEntitled ||
    confirmedEntitled ||
    (!staffBypass && enabled && optimisticEntitlement);
  const isPremiumTrial =
    !staffBypass && enabled ? isPremiumTrialPeriod(customerInfo) : false;
  // Boost: RC paid entitlement + DB `subscription === premium` (webhook). Never trial or optimistic.
  const canUseBoost =
    adminBoostBypass ||
    (enabled &&
      confirmedEntitled &&
      !isPremiumTrialPeriod(customerInfo) &&
      !optimisticEntitlement &&
      serverBoostEligible);

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      isCheckingSubscription,
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
    }),
    [
      enabled,
      isReady,
      isCheckingSubscription,
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
      serverBoostEligible,
      refresh,
      purchaseMonthly,
      purchasePackage,
      restore,
    ],
  );

  return (
    <RevenueCatContext.Provider value={value}>
      <RevenueCatUserSync
        enabled={enabled}
        onCustomerInfo={applyCustomerInfo}
        onUserLinked={() => void loadCatalog()}
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
      isCheckingSubscription: false,
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
      refresh: async () => null,
      purchaseMonthly: async () => {
        throw new Error("RevenueCatProvider missing");
      },
      purchasePackage: async () => {
        throw new Error("RevenueCatProvider missing");
      },
      restore: async () => {
        throw new Error("RevenueCatProvider missing");
      },
    };
  }
  return ctx;
}
