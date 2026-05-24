import { useEffect, useState } from "react";

export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

export function isTrialActive(trialStartsAt: Date | string | null | undefined): boolean {
  if (trialStartsAt == null) return false;
  const start = new Date(trialStartsAt as string).getTime();
  if (!Number.isFinite(start)) return false;
  return Date.now() - start < TRIAL_MS;
}

export function isTrialExpired(trialStartsAt: Date | string | null | undefined): boolean {
  if (trialStartsAt == null) return false;
  const start = new Date(trialStartsAt as string).getTime();
  if (!Number.isFinite(start)) return false;
  return Date.now() - start >= TRIAL_MS;
}

export function trialDaysRemaining(trialStartsAt: Date | string | null | undefined): number | null {
  if (trialStartsAt == null) return null;
  const start = new Date(trialStartsAt as string).getTime();
  if (!Number.isFinite(start)) return null;
  const elapsed = Date.now() - start;
  if (elapsed >= TRIAL_MS) return 0;
  return Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
}

/** Re-render periodically so trial expiry is detected while the app stays open. */
export function useTrialClock(intervalMs = 60_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
