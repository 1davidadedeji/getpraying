import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
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

function getApiKey(): string | null {
  const apple = process.env.EXPO_PUBLIC_RC_APPLE_KEY;
  const google = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY;
  if (Platform.OS === "ios") return apple ?? null;
  if (Platform.OS === "android") return google ?? null;
  return null;
}

function computeEntitled(info: CustomerInfo | null): boolean {
  if (!info) return false;
  // RevenueCat entitlements are product-configurable. We treat "any active entitlement"
  // as subscribed to keep this generic until your dashboard naming is finalized.
  const ents = info.entitlements?.active ?? {};
  return Object.keys(ents).length > 0;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const apiKey = getApiKey();
        if (!apiKey) {
          setEnabled(false);
          setIsReady(true);
          return;
        }

        await Purchases.configure({ apiKey });
        setEnabled(true);

        const [o, info] = await Promise.all([
          Purchases.getOfferings(),
          Purchases.getCustomerInfo(),
        ]);
        setOfferings(o);
        setCustomerInfo(info);
      } catch {
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const refresh = async () => {
    if (!enabled) return;
    const [o, info] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ]);
    setOfferings(o);
    setCustomerInfo(info);
  };

  const purchasePackage = async (pkg: PurchasesPackage) => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(info);
  };

  const restore = async () => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
  };

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      offerings,
      customerInfo,
      isEntitled: computeEntitled(customerInfo),
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
      isEntitled: false,
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

