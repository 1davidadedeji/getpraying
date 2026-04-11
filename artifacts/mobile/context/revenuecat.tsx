import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";

type RevenueCatState = {
  enabled: boolean;
  isReady: boolean;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;
  isEntitled: boolean;
  refresh: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<void>;
};

const RevenueCatContext = createContext<RevenueCatState | null>(null);

/** Load native module only when needed — avoids eager init at bundle parse (release crash risk with billing SDK). */
function getPurchases() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-purchases").default;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    (async () => {
      // TODO: Re-enable RevenueCat for final milestone — restore SDK initialization below; remove bypass flags.
      setEnabled(false);
      setIsReady(true);
      return;

      /* Original RevenueCat init (preserved) — use EXPO_PUBLIC_RC_* keys + getPurchases() then configure.
      try {
        const apiKey = ...;
        const Purchases = getPurchases();
        await Purchases.configure({ apiKey });
        ...
      } catch { } finally { setIsReady(true); }
      */
    })();
  }, []);

  const refresh = async () => {
    if (!enabled) return;
    const Purchases = getPurchases();
    const [o, info] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ]);
    setOfferings(o);
    setCustomerInfo(info);
  };

  const purchasePackage = async (pkg: PurchasesPackage) => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(info);
  };

  const restore = async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
  };

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      offerings,
      customerInfo,
      // TODO: Re-enable RevenueCat for final milestone — restore: computeEntitled(customerInfo)
      isEntitled: true,
      refresh,
      purchasePackage,
      restore,
    }),
    [enabled, isReady, offerings, customerInfo],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatState {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    return {
      enabled: false,
      isReady: true,
      offerings: null,
      customerInfo: null,
      // TODO: Re-enable RevenueCat for final milestone — restore: isEntitled: false
      isEntitled: true,
      refresh: async () => {},
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
