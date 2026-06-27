import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  },
}));

import {
  RESEND_COOLDOWN_STEPS_SECS,
  loadResendCooldown,
  remainingCooldownSecs,
  resendCooldownSecsForCount,
  saveResendCooldown,
} from "./resendCooldown";

beforeEach(() => {
  store.clear();
});

describe("resendCooldownSecsForCount", () => {
  it("returns 0 before any resend", () => {
    expect(resendCooldownSecsForCount(0)).toBe(0);
  });

  it("mirrors the server escalation and clamps at the last step", () => {
    expect(resendCooldownSecsForCount(1)).toBe(60);
    expect(resendCooldownSecsForCount(2)).toBe(120);
    expect(resendCooldownSecsForCount(3)).toBe(300);
    expect(resendCooldownSecsForCount(4)).toBe(600);
    expect(resendCooldownSecsForCount(50)).toBe(RESEND_COOLDOWN_STEPS_SECS.at(-1));
  });
});

describe("remainingCooldownSecs", () => {
  it("rounds up the remaining time and never goes negative", () => {
    expect(remainingCooldownSecs(10_400, 0)).toBe(11);
    expect(remainingCooldownSecs(0, 10_000)).toBe(0);
    expect(remainingCooldownSecs(Number.NaN, 0)).toBe(0);
  });
});

describe("persistence", () => {
  it("round-trips a cooldown state keyed by normalized email", async () => {
    await saveResendCooldown("USER@Example.com", { count: 2, nextAllowedAt: 5_000 });
    const loaded = await loadResendCooldown("user@example.com");
    expect(loaded).toEqual({ count: 2, nextAllowedAt: 5_000 });
  });

  it("returns null for missing or malformed entries", async () => {
    expect(await loadResendCooldown("nobody@example.com")).toBeNull();
    store.set("@getpraying/resendCooldown/bad@example.com", "{not json");
    expect(await loadResendCooldown("bad@example.com")).toBeNull();
    store.set("@getpraying/resendCooldown/partial@example.com", JSON.stringify({ count: 1 }));
    expect(await loadResendCooldown("partial@example.com")).toBeNull();
  });
});
