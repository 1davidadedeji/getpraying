import type { CustomerInfo } from "react-native-purchases";
import type { User } from "@workspace/api-client-react";
import { purchaseErrorMessage } from "@/lib/revenuecatPurchase";
import { isSubscribed, type SubscriptionAccessRc } from "@/lib/subscriptionAccess";

export type RestorePurchasesInput = {
  restore: () => Promise<CustomerInfo>;
  user: User | null | undefined;
  rc: SubscriptionAccessRc;
};

export type RestorePurchasesResult = {
  ok: boolean;
  title: string;
  message: string;
};

export async function restorePurchasesWithFeedback(
  input: RestorePurchasesInput,
): Promise<RestorePurchasesResult> {
  if (!input.rc.enabled) {
    return {
      ok: false,
      title: "Not available",
      message: "In-app purchases are not configured on this build.",
    };
  }

  try {
    const info = await input.restore();
    const rcAfter: SubscriptionAccessRc = { enabled: true, customerInfo: info };
    if (isSubscribed(input.user, rcAfter)) {
      return {
        ok: true,
        title: "Purchases restored",
        message: "Your subscription is active on this device.",
      };
    }
    return {
      ok: false,
      title: "No subscription found",
      message:
        "We couldn't find an active subscription for this Apple ID or Google account.",
    };
  } catch (err) {
    return {
      ok: false,
      title: "Restore failed",
      message: purchaseErrorMessage(err, "Please try again in a moment."),
    };
  }
}
