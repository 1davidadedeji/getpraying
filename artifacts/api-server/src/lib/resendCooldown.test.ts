import { describe, expect, it } from "vitest";
import {
  RESEND_COOLDOWN_STEPS_MS,
  checkResend,
  recordResend,
  resendCooldownMsForCount,
} from "./resendCooldown";

describe("resendCooldownMsForCount", () => {
  it("returns 0 before any resend", () => {
    expect(resendCooldownMsForCount(0)).toBe(0);
    expect(resendCooldownMsForCount(-1)).toBe(0);
  });

  it("escalates and clamps at the last step", () => {
    expect(resendCooldownMsForCount(1)).toBe(60_000);
    expect(resendCooldownMsForCount(2)).toBe(120_000);
    expect(resendCooldownMsForCount(3)).toBe(300_000);
    expect(resendCooldownMsForCount(4)).toBe(600_000);
    expect(resendCooldownMsForCount(99)).toBe(RESEND_COOLDOWN_STEPS_MS.at(-1));
  });
});

describe("checkResend", () => {
  it("allows when there is no prior entry", () => {
    expect(checkResend(undefined, 1_000)).toEqual({ allowed: true, waitSecs: 0 });
  });

  it("blocks until the deadline and reports waitSecs (rounded up)", () => {
    const now = 1_000_000;
    const entry = { count: 1, nextAllowedAt: now + 30_500 };
    expect(checkResend(entry, now)).toEqual({ allowed: false, waitSecs: 31 });
  });

  it("allows once the deadline has passed", () => {
    const now = 1_000_000;
    const entry = { count: 1, nextAllowedAt: now - 1 };
    expect(checkResend(entry, now)).toEqual({ allowed: true, waitSecs: 0 });
  });
});

describe("recordResend", () => {
  it("escalates the cooldown across successive resends", () => {
    const now = 0;
    const first = recordResend(undefined, now);
    expect(first).toEqual({ count: 1, nextAllowedAt: 60_000 });

    const second = recordResend(first, now);
    expect(second).toEqual({ count: 2, nextAllowedAt: 120_000 });

    const third = recordResend(second, now);
    expect(third).toEqual({ count: 3, nextAllowedAt: 300_000 });
  });
});
