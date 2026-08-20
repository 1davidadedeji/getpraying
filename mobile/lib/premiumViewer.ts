import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { shouldBlurOfficialForViewer, shouldBlurPremiumForViewer } from "@/lib/premiumContent";
import { isSubscribed } from "@/lib/subscriptionAccess";

export { shouldBlurPremiumForViewer } from "@/lib/premiumContent";

export function usePremiumViewer() {
  const { user } = useAuth();
  const rc = useRevenueCat();
  const subscribed = isSubscribed(user, rc);
  return {
    subscribed,
    shouldBlur: (item: { isPremium?: boolean | null }) => shouldBlurPremiumForViewer(item, subscribed),
    shouldBlurOfficial: (item: { isPremium?: boolean | null; scheduleSlot?: string | null }) =>
      shouldBlurOfficialForViewer(item, subscribed),
  };
}
