import { describe, expect, it } from "vitest";
import {
  isServerBoostEligible,
  isServerPaidPremium,
  isServerTrialSubscription,
  subscriptionTierGrantsBoost,
  userCanUseBoostNow,
} from "./serverSubscription";

describe("isServerPaidPremium", () => {
  it("is true only for the paid premium tier", () => {
    expect(isServerPaidPremium("premium")).toBe(true);
    expect(isServerPaidPremium("trial")).toBe(false);
    expect(isServerPaidPremium("free")).toBe(false);
    expect(isServerPaidPremium(null)).toBe(false);
  });
});

describe("subscriptionTierGrantsBoost (mirrors server)", () => {
  it("includes trial alongside premium", () => {
    expect(subscriptionTierGrantsBoost("premium")).toBe(true);
    expect(subscriptionTierGrantsBoost("trial")).toBe(true);
    expect(subscriptionTierGrantsBoost("free")).toBe(false);
  });
});

describe("isServerBoostEligible", () => {
  it("grants admins, trial and paid members", () => {
    expect(isServerBoostEligible({ role: "admin", subscription: "free" } as never)).toBe(true);
    expect(isServerBoostEligible({ role: "user", subscription: "trial" } as never)).toBe(true);
    expect(isServerBoostEligible({ role: "user", subscription: "premium" } as never)).toBe(true);
  });

  it("denies free members and missing users", () => {
    expect(isServerBoostEligible({ role: "user", subscription: "free" } as never)).toBe(false);
    expect(isServerBoostEligible(null)).toBe(false);
  });
});

describe("userCanUseBoostNow", () => {
  it("allows paid users and admins", () => {
    expect(userCanUseBoostNow({ role: "admin", subscription: "free" } as never)).toBe(true);
    expect(userCanUseBoostNow({ role: "user", subscription: "premium" } as never)).toBe(true);
  });

  it("allows trial users until their one boost is used", () => {
    expect(
      userCanUseBoostNow({ role: "user", subscription: "trial", trialBoostUsed: false } as never),
    ).toBe(true);
    expect(
      userCanUseBoostNow({ role: "user", subscription: "trial", trialBoostUsed: true } as never),
    ).toBe(false);
  });
});

describe("isServerTrialSubscription", () => {
  it("detects trial tier", () => {
    expect(isServerTrialSubscription("trial")).toBe(true);
    expect(isServerTrialSubscription("premium")).toBe(false);
  });
});
