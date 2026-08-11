import { showSubscriptionPrompt } from "@/context/subscriptionPrompt";
import {
  armPremiumPlayAfterSubscribe,
  cancelPremiumPlayAfterSubscribe,
} from "@/lib/premiumUnlockSession";

type PromptOpts = {
  /** After subscribe + unlock, run this (e.g. start audio playback). */
  onUnlocked?: () => void;
};

/** Show the premium-content upsell sheet with the standard copy and CTAs. */
export function promptPremiumContentUnlock(opts?: PromptOpts): void {
  if (opts?.onUnlocked) {
    armPremiumPlayAfterSubscribe(opts.onUnlocked);
  } else {
    cancelPremiumPlayAfterSubscribe();
  }
  showSubscriptionPrompt("premiumContent");
}
