const MS_PER_DAY = 86_400_000;

export function daysSinceJoined(createdAt: Date | string, now: Date = new Date()): number {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return 0;
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
}

/** Legacy trial tier counts as subscribed for prompt suppression. */
export function subscriptionSuppressesRecurringPrompt(
  subscription: string | null | undefined,
): boolean {
  const tier = String(subscription ?? "free").toLowerCase();
  return tier === "premium" || tier === "trial";
}

export function isRecurringPromptDue(
  user: {
    subscription?: string | null;
    createdAt: Date | string;
    subscriptionPromptLastShownAt?: Date | string | null;
  },
  now: Date = new Date(),
): boolean {
  if (subscriptionSuppressesRecurringPrompt(user.subscription)) return false;

  const daysJoined = daysSinceJoined(user.createdAt, now);
  if (daysJoined < 7) return false;

  const lastShown = user.subscriptionPromptLastShownAt;
  if (lastShown == null) return true;

  const last = new Date(lastShown);
  if (Number.isNaN(last.getTime())) return true;

  const daysSinceLastShown = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
  return daysSinceLastShown >= 7;
}

export function recurringPromptStatus(
  user: {
    subscription?: string | null;
    createdAt: Date | string;
    subscriptionPromptLastShownAt?: Date | string | null;
  },
  now: Date = new Date(),
): { daysSinceJoined: number; recurringPromptDue: boolean } {
  const days = daysSinceJoined(user.createdAt, now);
  return {
    daysSinceJoined: days,
    recurringPromptDue: isRecurringPromptDue(user, now),
  };
}
