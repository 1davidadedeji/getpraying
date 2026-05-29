import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";
import { useAuth } from "@/context/auth";
import {
  canUseBoostFeature,
  hasPremiumEntitlement,
  isPremiumTrialPeriod,
  PREMIUM_ENTITLEMENT_ID,
} from "@/lib/revenuecatEntitlements";
import { isStaffUser } from "@/lib/staffAccess";

/** Must match the Offering identifier in the RevenueCat dashboard. */
export const DEFAULT_OFFERING_ID = "default";

export { PREMIUM_ENTITLEMENT_ID };

export function getDefaultOffering(
  offerings: PurchasesOfferings | null | undefined,
): PurchasesOfferings["current"] {
  if (!offerings) return null;
  return offerings.current ?? offerings.all?.[DEFAULT_OFFERING_ID] ?? null;
}

export function getMonthlyPackage(
  offerings: PurchasesOfferings | null | undefined,
): PurchasesPackage | null {
  const offering = getDefaultOffering(offerings);
  if (!offering) return null;
  return (
    offering.monthly ??
    offering.availablePackages.find((p) => p.packageType === "MONTHLY") ??
    offering.availablePackages.find((p) => /month/i.test(p.identifier)) ??
    offering.availablePackages[0] ??
    null
  );
}

type RevenueCatState = {
  enabled: boolean;
  isReady: boolean;
  offerings: PurchasesOfferings | null;
  monthlyPackage: PurchasesPackage | null;
  customerInfo: CustomerInfo | null;
  isEntitled: boolean;
  isPremiumTrial: boolean;
  canUseBoost: boolean;
  refresh: () => Promise<void>;
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
}: {
  enabled: boolean;
  onCustomerInfo: (info: CustomerInfo | null) => void;
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
      } catch {
        /* ignore — anonymous customer still works for new purchases */
      }
    })();
  }, [enabled, user?.id, linkedUserId, onCustomerInfo]);

  return null;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const staffBypass = isStaffUser(user);
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

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!enabled) throw new Error("RevenueCat not configured");
    const Purchases = getPurchases();
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(info);
    if (!hasPremiumEntitlement(info)) {
      throw new Error("Purchase completed but premium access was not activated.");
    }
  }, [enabled]);

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
    const url = customerInfo?.managementURL;
    if (url) {
      await Linking.openURL(url);
      return;
    }
    throw new Error("Subscription options are not available right now.");
  }, [enabled, offerings, customerInfo?.managementURL, purchasePackage]);

  const isEntitled = staffBypass || (enabled ? hasPremiumEntitlement(customerInfo) : false);
  const isPremiumTrial =
    !staffBypass && enabled ? isPremiumTrialPeriod(customerInfo) : false;
  const canUseBoost = staffBypass || (enabled ? canUseBoostFeature(customerInfo) : false);
  const monthlyPackage = useMemo(() => getMonthlyPackage(offerings), [offerings]);

  const value: RevenueCatState = useMemo(
    () => ({
      enabled,
      isReady,
      offerings,
      monthlyPackage,
      customerInfo,
      isEntitled,
      isPremiumTrial,
      canUseBoost,
      refresh,
      purchasePackage,
      restore,
      upgradeFromTrial,
    }),
    [
      enabled,
      isReady,
      offerings,
      monthlyPackage,
      customerInfo,
      isEntitled,
      isPremiumTrial,
      canUseBoost,
      upgradeFromTrial,
      purchasePackage,
      restore,
    ],
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
      monthlyPackage: null,
      customerInfo: null,
      isEntitled: false,
      isPremiumTrial: false,
      canUseBoost: false,
      refresh: async () => {},
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
