import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";
import { useAuth } from "@/context/auth";

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
}: {
  enabled: boolean;
  onCustomerInfo: (info: CustomerInfo) => void;
}) {
  const { user } = useAuth();
  const [linkedUserId, setLinkedUserId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!enabled || !user?.id) return;
      if (linkedUserId === user.id) return;
      try {
        const Purchases = getPurchases();
        const { customerInfo: info } = await Purchases.logIn(String(user.id));
        onCustomerInfo(info);
        setLinkedUserId(user.id);
      } catch {
        /* ignore — anonymous customer still works for new purchases */
      }
    })();
  }, [enabled, user?.id, linkedUserId, onCustomerInfo]);

  return null;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

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
          const [o, info] = await Promise.all([
            Purchases.getOfferings(),
            Purchases.getCustomerInfo(),
          ]);
          setOfferings(o);
          setCustomerInfo(info);
        } catch {
          // Offerings can fail before App Store products are linked in RevenueCat.
          try {
            const info = await Purchases.getCustomerInfo();
            setCustomerInfo(info);
          } catch {
            /* ignore */
          }
        }
      } catch {
        setEnabled(false);
      } finally {
        setIsReady(true);
      }
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

  const isEntitled = enabled
    ? Object.keys(customerInfo?.entitlements?.active ?? {}).length > 0
    : false;

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      offerings,
      customerInfo,
      isEntitled,
      refresh,
      purchasePackage,
      restore,
    }),
    [enabled, isReady, offerings, customerInfo, isEntitled],
  );

  return (
    <RevenueCatContext.Provider value={value}>
      <RevenueCatUserSync enabled={enabled} onCustomerInfo={setCustomerInfo} />
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
