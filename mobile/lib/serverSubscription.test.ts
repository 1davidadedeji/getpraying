import { describe, expect, it } from "vitest";
import {
  isServerBoostEligible,
  isServerPaidPremium,
  isServerTrialSubscription,
  subscriptionTierGrantsUnlimitedBoost,
  userCanUseBoostNow,
  userNeedsStoreEntitlementForBoost,
} from "./serverSubscription";

describe("isServerPaidPremium", () => {
  it("is true only for the paid premium tier", () => {
    expect(isServerPaidPremium("premium")).toBe(true);
    expect(isServerPaidPremium("trial")).toBe(false);
    expect(isServerPaidPremium("free")).toBe(false);
  });
});

describe("subscriptionTierGrantsUnlimitedBoost", () => {
  it("includes premium and legacy trial", () => {
    expect(subscriptionTierGrantsUnlimitedBoost("premium")).toBe(true);
    expect(subscriptionTierGrantsUnlimitedBoost("trial")).toBe(true);
    expect(subscriptionTierGrantsUnlimitedBoost("free")).toBe(false);
  });
});

describe("isServerBoostEligible", () => {
  it("includes free users who may use their one boost", () => {
    expect(isServerBoostEligible({ role: "user", subscription: "free" } as never)).toBe(true);
    expect(isServerBoostEligible({ role: "user", subscription: "premium" } as never)).toBe(true);
    expect(isServerBoostEligible({ role: "admin", subscription: "free" } as never)).toBe(true);
  });
});

describe("userCanUseBoostNow", () => {
  it("allows unlimited tiers regardless of freeBoostUsed flag", () => {
    expect(userCanUseBoostNow({ role: "user", subscription: "premium" } as never)).toBe(true);
    expect(
      userCanUseBoostNow({ role: "user", subscription: "trial", freeBoostUsed: true } as never),
    ).toBe(true);
  });

  it("blocks free users after free boost is used", () => {
    expect(
      userCanUseBoostNow({ role: "user", subscription: "free", freeBoostUsed: false } as never),
    ).toBe(true);
    expect(
      userCanUseBoostNow({ role: "user", subscription: "free", freeBoostUsed: true } as never),
    ).toBe(false);
  });

  it("allows admins always", () => {
    expect(userCanUseBoostNow({ role: "admin", subscription: "free" } as never)).toBe(true);
  });
});

describe("userNeedsStoreEntitlementForBoost", () => {
  it("is false for free tier and admin", () => {
    expect(userNeedsStoreEntitlementForBoost({ role: "user", subscription: "free" } as never)).toBe(
      false,
    );
    expect(userNeedsStoreEntitlementForBoost({ role: "admin", subscription: "free" } as never)).toBe(
      false,
    );
  });

  it("is true for subscribed tiers", () => {
    expect(
      userNeedsStoreEntitlementForBoost({ role: "user", subscription: "premium" } as never),
    ).toBe(true);
  });
});

describe("isServerTrialSubscription", () => {
  it("detects trial", () => {
    expect(isServerTrialSubscription("trial")).toBe(true);
    expect(isServerTrialSubscription("premium")).toBe(false);
  });
});
