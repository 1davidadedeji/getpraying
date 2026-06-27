import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Client-side mirror of the server resend cooldown. The server
 * (`artifacts/api-server/src/lib/resendCooldown.ts`) is authoritative — these
 * values MUST match it so the on-screen countdown agrees with the 429 the
 * server would return. Persisting the deadline means the cooldown survives
 * navigating away, backgrounding, or relaunching the app (it cannot be reset
 * by simply leaving and returning to the verify screen).
 */
export const RESEND_COOLDOWN_STEPS_SECS = [60, 120, 300, 600] as const;

/** Cooldown (seconds) the server applies after the Nth successful resend. */
export function resendCooldownSecsForCount(count: number): number {
  if (count <= 0) return 0;
  const idx = Math.min(count - 1, RESEND_COOLDOWN_STEPS_SECS.length - 1);
  return RESEND_COOLDOWN_STEPS_SECS[idx] ?? 600;
}

/** Seconds remaining until `nextAllowedAt`, clamped at 0. */
export function remainingCooldownSecs(nextAllowedAt: number, now: number): number {
  if (!Number.isFinite(nextAllowedAt)) return 0;
  return Math.max(0, Math.ceil((nextAllowedAt - now) / 1000));
}

export type ResendCooldownState = { nextAllowedAt: number; count: number };

function storageKey(email: string): string {
  return `@getpraying/resendCooldown/${email.trim().toLowerCase()}`;
}

export async function loadResendCooldown(email: string): Promise<ResendCooldownState | null> {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(storageKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ResendCooldownState>;
    if (typeof parsed?.nextAllowedAt !== "number" || typeof parsed?.count !== "number") {
      return null;
    }
    return { nextAllowedAt: parsed.nextAllowedAt, count: parsed.count };
  } catch {
    return null;
  }
}

export async function saveResendCooldown(
  email: string,
  state: ResendCooldownState,
): Promise<void> {
  if (!email) return;
  try {
    await AsyncStorage.setItem(storageKey(email), JSON.stringify(state));
  } catch {
    /* non-fatal: server still enforces the limit */
  }
}
