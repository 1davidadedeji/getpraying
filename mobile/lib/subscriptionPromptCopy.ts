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
          "Subscribe to Get Praying for unlimited Prayer Boosts and help support the Get Praying community.\n\nYour subscription also includes access to exclusive prayer content from select celebrities and global faith leaders, along with premium community features.",
        subscribeLabel: SUBSCRIBE_LABEL,
        notNowLabel: NOT_NOW_LABEL,
      };
    case "recurring": {
      const days = typeof daysSinceJoined === "number" ? daysSinceJoined : 0;
      return {
        title: `You've Been Praying With Us for ${days} Days`,
        message:
          "Now, help support the Get Praying community and unlock the full experience.\n\nSubscribe to access exclusive prayer content from select celebrities and global faith leaders in the library, unlimited Prayer Boosts, and premium community features.\n\nA portion of every subscription helps support and grow the Get Praying community.",
        subscribeLabel: SUBSCRIBE_LABEL,
        notNowLabel: NOT_NOW_LABEL,
      };
    }
    case "premiumContent":
      return {
        title: "This Content Is Premium Prayer Content",
        message:
          "Subscribe to access exclusive prayers and messages from select celebrities and global faith leaders.\n\nYour subscription also helps support and grow the Get Praying community.",
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
