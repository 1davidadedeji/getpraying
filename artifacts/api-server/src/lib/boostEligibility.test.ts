import { describe, expect, it } from "vitest";
import {
  boostAvailabilityError,
  FREE_BOOST_EXHAUSTED_MESSAGE,
  isFreeSubscription,
  isTrialSubscription,
  subscriptionTierGrantsUnlimitedBoost,
  UNLIMITED_BOOST_TIERS,
  userFreeBoostConsumed,
  userIsBoostEligible,
} from "./boostEligibility";

describe("subscriptionTierGrantsUnlimitedBoost", () => {
  it("includes paid and legacy trial tiers only", () => {
    expect(UNLIMITED_BOOST_TIERS.has("premium")).toBe(true);
    expect(UNLIMITED_BOOST_TIERS.has("trial")).toBe(true);
    expect(subscriptionTierGrantsUnlimitedBoost("premium")).toBe(true);
    expect(subscriptionTierGrantsUnlimitedBoost("trial")).toBe(true);
    expect(subscriptionTierGrantsUnlimitedBoost("free")).toBe(false);
  });
});

describe("userIsBoostEligible", () => {
  it("grants admins, subscribers, and free-tier users", () => {
    expect(userIsBoostEligible({ role: "admin", subscription: "free" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "trial" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "premium" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "free" })).toBe(true);
  });
});

describe("userFreeBoostConsumed", () => {
  it("is true only for free users who consumed their boost", () => {
    expect(userFreeBoostConsumed({ subscription: "free", freeBoostUsedAt: new Date() })).toBe(true);
    expect(userFreeBoostConsumed({ subscription: "free", freeBoostUsedAt: null })).toBe(false);
    expect(userFreeBoostConsumed({ subscription: "premium", freeBoostUsedAt: new Date() })).toBe(
      false,
    );
    expect(userFreeBoostConsumed({ subscription: "trial", freeBoostUsedAt: new Date() })).toBe(
      false,
    );
  });
});

describe("boostAvailabilityError", () => {
  it("returns free boost message when free quota is exhausted", async () => {
    const err = await boostAvailabilityError({
      id: 1,
      role: "user",
      subscription: "free",
      freeBoostUsedAt: new Date(),
    });
    expect(err).toBe(FREE_BOOST_EXHAUSTED_MESSAGE);
  });

  it("returns null for free users with quota remaining", async () => {
    const err = await boostAvailabilityError({
      id: 1,
      role: "user",
      subscription: "free",
      freeBoostUsedAt: null,
    });
    expect(err).toBeNull();
  });

  it("returns null for unlimited subscribers", async () => {
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

describe("isFreeSubscription", () => {
  it("detects free tier", () => {
    expect(isFreeSubscription("free")).toBe(true);
    expect(isFreeSubscription(null)).toBe(true);
    expect(isFreeSubscription("premium")).toBe(false);
  });
});
