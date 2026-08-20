export type SubscriptionPromptVariant =
  | "freeBoostExhausted"
  | "recurring"
  | "premiumContent";

const SUBSCRIBE_LABEL = "Subscribe Now — $6.99/month";
const NOT_NOW_LABEL = "Not Now";

export function subscriptionPromptCopy(
  variant: SubscriptionPromptVariant,
  daysSinceJoined?: number,
): { title: string; message: string; subscribeLabel: string; notNowLabel: string } {
  switch (variant) {
    case "freeBoostExhausted":
      return {
        title: "You've Used Your Free Prayer Boost",
        message:
          "Subscribe for unlimited Prayer Boosts and exclusive library content from faith leaders worldwide.",
        subscribeLabel: SUBSCRIBE_LABEL,
        notNowLabel: NOT_NOW_LABEL,
      };
    case "recurring": {
      const days = typeof daysSinceJoined === "number" ? daysSinceJoined : 0;
      return {
        title: `You've Been Praying With Us for ${days} Days`,
        message:
          "Unlock the full library, unlimited boosts, and premium features — and help grow the Get Praying community.",
        subscribeLabel: SUBSCRIBE_LABEL,
        notNowLabel: NOT_NOW_LABEL,
      };
    }
    case "premiumContent":
      return {
        title: "Premium Prayer Content",
        message:
          "Subscribe to unlock this guide and other exclusive prayers from global faith leaders.",
        subscribeLabel: SUBSCRIBE_LABEL,
        notNowLabel: NOT_NOW_LABEL,
      };
  }
}

/** Lower number = higher priority when replacing an open prompt. */
export function subscriptionPromptPriority(variant: SubscriptionPromptVariant): number {
  switch (variant) {
    case "premiumContent":
      return 0;
    case "freeBoostExhausted":
      return 1;
    case "recurring":
      return 2;
  }
}
