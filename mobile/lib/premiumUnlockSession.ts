/** Pending playback/content action after a successful premium subscription. */
let pendingAfterSubscribe: (() => void) | null = null;

export function armPremiumPlayAfterSubscribe(action: () => void): void {
  pendingAfterSubscribe = action;
}

export function cancelPremiumPlayAfterSubscribe(): void {
  pendingAfterSubscribe = null;
}

/** Run and clear a pending unlock action (e.g. auto-play). Returns true if one ran. */
export function consumePremiumPlayAfterSubscribe(): boolean {
  const action = pendingAfterSubscribe;
  pendingAfterSubscribe = null;
  if (!action) return false;
  try {
    action();
  } catch (e) {
    console.warn("[premium] post-subscribe action failed:", e);
  }
  return true;
}
