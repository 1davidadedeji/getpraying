import type { CustomerInfo } from "react-native-purchases";
import type { User } from "@workspace/api-client-react";
import { hasPremiumEntitlement } from "@/lib/revenuecatEntitlements";
import { isStaffUser } from "@/lib/staffAccess";
import { isServerPaidPremium, isServerTrialSubscription } from "@/lib/serverSubscription";

export type SubscriptionAccessRc = {
  enabled: boolean;
  customerInfo: CustomerInfo | null;
};

/** Active subscription — store entitlement or server premium/legacy trial tier. */
export function isSubscribed(
  user: User | null | undefined,
  rc?: SubscriptionAccessRc | null,
): boolean {
  if (!user) return false;
  if (isStaffUser(user)) return true;
  if (isServerPaidPremium(user.subscription) || isServerTrialSubscription(user.subscription)) {
    return true;
  }
  if (rc?.enabled && hasPremiumEntitlement(rc.customerInfo)) return true;
  return false;
}
