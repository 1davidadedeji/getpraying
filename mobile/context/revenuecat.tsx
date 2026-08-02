import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import { showAppAlert } from "@/components/AppAlert";
import { useAuth } from "@/context/auth";
import {
  billingIssueDetectedAt,
  hasBillingIssue,
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
import { isServerPaidPremium } from "@/lib/serverSubscription";
import { isStaffUser } from "@/lib/staffAccess";
import { userCanUseBoostNow, userNeedsStoreEntitlementForBoost } from "@/lib/serverSubscription";
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
  /** Store flagged a payment problem (grace period). Access continues; nudge to fix. */
  billingIssue: boolean;
  canUseBoost: boolean;
  refresh: () => Promise<CustomerInfo | null>;
  /** Load StoreKit offerings — call from paywall only (slow on physical iOS). */
  loadCatalog: () => Promise<void>;
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
}: {
  enabled: boolean;
  onCustomerInfo: (info: CustomerInfo | null) => void;
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
      } catch {
        /* ignore — anonymous customer still works for new purchases */
      }
    })();
  }, [enabled, user?.id, linkedUserId, onCustomerInfo]);

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
  const lastServerRefreshRef = useRef(0);

  const applyCustomerInfo = useCallback(
    (info: CustomerInfo | null) => {
      setCustomerInfo(info);
      if (hasPremiumEntitlement(info)) {
        setOptimisticEntitlement(false);
        const now = Date.now();
        if (now - lastServerRefreshRef.current > 30_000) {
          lastServerRefreshRef.current = now;
          void refreshUserFromServer();
        }
      }
    },
    [refreshUserFromServer],
  );

  useEffect(() => {
    if (!user?.id) {
      setOptimisticEntitlement(false);
    }
  }, [user?.id]);

  // Insufficient-funds / billing-failure workflow: the store keeps the user
  // entitled during its retry/grace window (we never revoke here — only the
  // EXPIRATION webhook does). Nudge them once per detection to fix payment, and
  // deep-link to the store's manage-subscription screen. The store also shows
  // its own native prompt; this is a friendly in-app reminder.
  const billingNudgeShownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const detectedAt = billingIssueDetectedAt(customerInfo);
    if (!detectedAt) {
      billingNudgeShownFor.current = null;
      return;
    }
    if (billingNudgeShownFor.current === detectedAt) return;
    billingNudgeShownFor.current = detectedAt;

    const manageUrl = customerInfo?.managementURL;
    showAppAlert({
      title: "Payment problem",
      message:
        "There's an issue with your payment method, so your last charge didn't go through. " +
        "Update your payment details to keep your subscription active.",
      buttons: manageUrl
        ? [
            { text: "Not now", style: "cancel" },
            { text: "Update payment", onPress: () => void Linking.openURL(manageUrl) },
          ]
        : [{ text: "OK" }],
    });
  }, [enabled, customerInfo]);

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
        // Unblock splash + entitlement gate before StoreKit customer-info fetch (slow on physical iOS).
        setIsReady(true);

        removeListener = Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);

        void (async () => {
          try {
            const info = await Purchases.getCustomerInfo();
            applyCustomerInfo(info);
          } catch {
            /* ignore — listener will update when StoreKit responds */
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
  const confirmedEntitled = enabled ? hasPremiumEntitlement(customerInfo) : false;
  const serverEntitled = isServerPaidPremium(user?.subscription);
  const isEntitled =
    staffBypass ||
    serverEntitled ||
    confirmedEntitled ||
    (!staffBypass && enabled && optimisticEntitlement);
  const isPremiumTrial =
    !staffBypass && enabled ? isPremiumTrialPeriod(customerInfo) : false;
  const billingIssue = enabled ? hasBillingIssue(customerInfo) : false;
  const needsStoreForBoost = userNeedsStoreEntitlementForBoost(user);
  // Free tier: one lifetime boost without RevenueCat. Subscribers: unlimited after store + webhook sync.
  const canUseBoost =
    adminBoostBypass ||
    (userCanUseBoostNow(user) &&
      (needsStoreForBoost
        ? enabled && confirmedEntitled && !optimisticEntitlement
        : true));

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
      billingIssue,
      canUseBoost,
      refresh,
      loadCatalog,
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
      billingIssue,
      canUseBoost,
      refresh,
      loadCatalog,
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
      billingIssue: false,
      canUseBoost: false,
      refresh: async () => null,
      loadCatalog: async () => {},
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
