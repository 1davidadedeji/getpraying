import { describe, expect, it } from "vitest";
import {
  BOOST_TIERS,
  boostAvailabilityError,
  isTrialSubscription,
  subscriptionTierGrantsBoost,
  TRIAL_BOOST_EXHAUSTED_MESSAGE,
  userIsBoostEligible,
  userTrialBoostUsed,
} from "./boostEligibility";

describe("subscriptionTierGrantsBoost", () => {
  it("includes paid and trial tiers", () => {
    expect(BOOST_TIERS.has("premium")).toBe(true);
    expect(BOOST_TIERS.has("trial")).toBe(true);
    expect(subscriptionTierGrantsBoost("premium")).toBe(true);
    expect(subscriptionTierGrantsBoost("trial")).toBe(true);
    expect(subscriptionTierGrantsBoost("free")).toBe(false);
  });
});

describe("userIsBoostEligible", () => {
  it("grants admins and subscribed tiers", () => {
    expect(userIsBoostEligible({ role: "admin", subscription: "free" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "trial" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "premium" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "free" })).toBe(false);
  });
});

describe("userTrialBoostUsed", () => {
  it("is true only for trial users who consumed their boost", () => {
    expect(userTrialBoostUsed({ subscription: "trial", trialBoostUsedAt: new Date() })).toBe(true);
    expect(userTrialBoostUsed({ subscription: "trial", trialBoostUsedAt: null })).toBe(false);
    expect(userTrialBoostUsed({ subscription: "premium", trialBoostUsedAt: new Date() })).toBe(false);
  });
});

describe("boostAvailabilityError", () => {
  it("returns trial message when trial boost is exhausted", async () => {
    const err = await boostAvailabilityError({
      id: 1,
      role: "user",
      subscription: "trial",
      trialBoostUsedAt: new Date(),
    });
    expect(err).toBe(TRIAL_BOOST_EXHAUSTED_MESSAGE);
  });

  it("returns subscribe message for free users", async () => {
    const err = await boostAvailabilityError({
      id: 1,
      role: "user",
      subscription: "free",
    });
    expect(err).toBe("Subscribe to Boost your prayer.");
  });

  it("returns null for paid subscribers", async () => {
    const err = await boostAvailabilityError({
      id: 1,
      role: "user",
      subscription: "premium",
    });
    expect(err).toBeNull();
  });
});

describe("isTrialSubscription", () => {
  it("detects trial tier", () => {
    expect(isTrialSubscription("trial")).toBe(true);
    expect(isTrialSubscription("premium")).toBe(false);
  });
});
