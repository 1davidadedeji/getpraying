import { promptPremiumContentUnlock } from "@/lib/promptPremiumContent";

type PremiumPostRef = { isPremium?: boolean | null; authorId?: number | null };

function isOwnPremiumPost(
  post: PremiumPostRef | null | undefined,
  viewerUserId?: number | null,
): boolean {
  return (
    viewerUserId != null &&
    post?.authorId != null &&
    viewerUserId === post.authorId
  );
}

/** Free viewer on a premium post — block engagement except author profile navigation. */
export function isPremiumInteractionBlocked(
  post: PremiumPostRef | null | undefined,
  subscribed: boolean,
  viewerUserId?: number | null,
): boolean {
  if (!post?.isPremium || subscribed) return false;
  if (isOwnPremiumPost(post, viewerUserId)) return false;
  return true;
}

/** Shows the premium upsell modal when blocked. Returns true if the action was blocked. */
export function gatePremiumInteraction(
  post: PremiumPostRef | null | undefined,
  subscribed: boolean,
  viewerUserId?: number | null,
): boolean {
  if (!isPremiumInteractionBlocked(post, subscribed, viewerUserId)) return false;
  promptPremiumContentUnlock();
  return true;
}
