import { describe, expect, it } from "vitest";
import {
  subscriptionTierGrantsBoost,
  userIsBoostEligible,
} from "./boostEligibility";

describe("subscriptionTierGrantsBoost", () => {
  it("grants boost to paid and trial subscribers", () => {
    expect(subscriptionTierGrantsBoost("premium")).toBe(true);
    expect(subscriptionTierGrantsBoost("trial")).toBe(true);
    expect(subscriptionTierGrantsBoost("TRIAL")).toBe(true);
  });

  it("denies boost to free / unknown / empty tiers", () => {
    expect(subscriptionTierGrantsBoost("free")).toBe(false);
    expect(subscriptionTierGrantsBoost(null)).toBe(false);
    expect(subscriptionTierGrantsBoost(undefined)).toBe(false);
    expect(subscriptionTierGrantsBoost("")).toBe(false);
  });
});

describe("userIsBoostEligible", () => {
  it("always grants admins", () => {
    expect(userIsBoostEligible({ role: "admin", subscription: "free" })).toBe(true);
  });

  it("grants trial and paid members", () => {
    expect(userIsBoostEligible({ role: "user", subscription: "trial" })).toBe(true);
    expect(userIsBoostEligible({ role: "user", subscription: "premium" })).toBe(true);
  });

  it("denies free members and missing users", () => {
    expect(userIsBoostEligible({ role: "user", subscription: "free" })).toBe(false);
    expect(userIsBoostEligible(null)).toBe(false);
    expect(userIsBoostEligible(undefined)).toBe(false);
  });
});
