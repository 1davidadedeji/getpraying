import { showSubscriptionPrompt } from "@/context/subscriptionPrompt";
import {
  armPremiumPlayAfterSubscribe,
  cancelPremiumPlayAfterSubscribe,
} from "@/lib/premiumUnlockSession";

type PromptOpts = {
  /** After subscribe + unlock, run this (e.g. start audio playback). */
  onUnlocked?: () => void;
};

type PremiumPromptAccess = {
  subscribed: boolean;
};

let premiumPromptAccess: PremiumPromptAccess = { subscribed: false };

/** Called by PremiumEntitlementCoordinator — suppresses upsell after subscribe. */
export function setPremiumPromptAccess(subscribed: boolean): void {
  premiumPromptAccess = { subscribed };
}

/** Show the premium-content upsell sheet with the standard copy and CTAs. */
export function promptPremiumContentUnlock(opts?: PromptOpts): void {
  if (premiumPromptAccess.subscribed) {
    opts?.onUnlocked?.();
    return;
  }
  if (opts?.onUnlocked) {
    armPremiumPlayAfterSubscribe(opts.onUnlocked);
  } else {
    cancelPremiumPlayAfterSubscribe();
  }
  showSubscriptionPrompt("premiumContent");
}
