import { describe, expect, it } from "vitest";
import {
  armPremiumPlayAfterSubscribe,
  cancelPremiumPlayAfterSubscribe,
  consumePremiumPlayAfterSubscribe,
} from "./premiumUnlockSession";

describe("premiumUnlockSession", () => {
  it("runs and clears a pending action once", () => {
    let ran = false;
    armPremiumPlayAfterSubscribe(() => {
      ran = true;
    });
    expect(consumePremiumPlayAfterSubscribe()).toBe(true);
    expect(ran).toBe(true);
    expect(consumePremiumPlayAfterSubscribe()).toBe(false);
  });

  it("cancel clears pending action", () => {
    armPremiumPlayAfterSubscribe(() => {});
    cancelPremiumPlayAfterSubscribe();
    expect(consumePremiumPlayAfterSubscribe()).toBe(false);
  });
});
