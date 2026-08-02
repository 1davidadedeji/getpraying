import { describe, expect, it } from "vitest";
import { subscriptionPromptCopy, subscriptionPromptPriority } from "./subscriptionPromptCopy";

describe("subscriptionPromptCopy", () => {
  it("uses exact recurring title with day count", () => {
    const copy = subscriptionPromptCopy("recurring", 14);
    expect(copy.title).toBe("You've Been Praying With Us for 14 Days");
    expect(copy.subscribeLabel).toBe("Subscribe Now — $6.99/month");
  });

  it("includes free boost exhausted headline", () => {
    const copy = subscriptionPromptCopy("freeBoostExhausted");
    expect(copy.title).toBe("You've Used Your Free Prayer Boost");
  });
});

describe("subscriptionPromptPriority", () => {
  it("ranks premium play above recurring", () => {
    expect(subscriptionPromptPriority("premiumContent")).toBeLessThan(
      subscriptionPromptPriority("recurring"),
    );
  });
});
