/**
 * Authoritative resend-verification cooldown (per email). Escalates so repeated
 * resends back off increasingly. The mobile client mirrors these values in
 * `mobile/lib/resendCooldown.ts` for its on-screen countdown — keep them in sync.
 */
export const RESEND_COOLDOWN_STEPS_MS = [60_000, 120_000, 300_000, 600_000] as const;

export function resendCooldownMsForCount(count: number): number {
  if (count <= 0) return 0;
  const idx = Math.min(count - 1, RESEND_COOLDOWN_STEPS_MS.length - 1);
  return RESEND_COOLDOWN_STEPS_MS[idx] ?? 600_000;
}

export type ResendEntry = { count: number; nextAllowedAt: number };

/** Whether a resend is allowed right now, and (if not) how long to wait. */
export function checkResend(
  entry: ResendEntry | undefined,
  now: number,
): { allowed: boolean; waitSecs: number } {
  if (!entry) return { allowed: true, waitSecs: 0 };
  if (now < entry.nextAllowedAt) {
    return { allowed: false, waitSecs: Math.ceil((entry.nextAllowedAt - now) / 1000) };
  }
  return { allowed: true, waitSecs: 0 };
}

/** Next entry after recording a successful resend at `now`. */
export function recordResend(entry: ResendEntry | undefined, now: number): ResendEntry {
  const count = entry ? entry.count + 1 : 1;
  return { count, nextAllowedAt: now + resendCooldownMsForCount(count) };
}
