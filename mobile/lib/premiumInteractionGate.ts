import { promptPremiumContentUnlock } from "@/lib/promptPremiumContent";

type PremiumPostRef = { isPremium?: boolean | null };

/** Free viewer on a premium post — block engagement except author profile navigation. */
export function isPremiumInteractionBlocked(
  post: PremiumPostRef | null | undefined,
  subscribed: boolean,
): boolean {
  return Boolean(post?.isPremium) && !subscribed;
}

/** Shows the premium upsell modal when blocked. Returns true if the action was blocked. */
export function gatePremiumInteraction(
  post: PremiumPostRef | null | undefined,
  subscribed: boolean,
): boolean {
  if (!isPremiumInteractionBlocked(post, subscribed)) return false;
  promptPremiumContentUnlock();
  return true;
}
