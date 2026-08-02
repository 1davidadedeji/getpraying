import { describe, expect, it } from "vitest";
import {
  daysSinceJoined,
  isRecurringPromptDue,
  recurringPromptStatus,
  subscriptionSuppressesRecurringPrompt,
} from "./subscriptionPromptSchedule";

const joined = new Date("2026-01-01T12:00:00.000Z");

describe("daysSinceJoined", () => {
  it("returns whole days since account creation", () => {
    expect(daysSinceJoined(joined, new Date("2026-01-08T12:00:00.000Z"))).toBe(7);
    expect(daysSinceJoined(joined, new Date("2026-01-07T23:59:00.000Z"))).toBe(6);
  });
});

describe("subscriptionSuppressesRecurringPrompt", () => {
  it("is true for premium and legacy trial", () => {
    expect(subscriptionSuppressesRecurringPrompt("premium")).toBe(true);
    expect(subscriptionSuppressesRecurringPrompt("trial")).toBe(true);
    expect(subscriptionSuppressesRecurringPrompt("free")).toBe(false);
  });
});

describe("isRecurringPromptDue", () => {
  it("is false before day 7", () => {
    expect(
      isRecurringPromptDue(
        { subscription: "free", createdAt: joined, subscriptionPromptLastShownAt: null },
        new Date("2026-01-07T12:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is true on day 7 when never shown", () => {
    expect(
      isRecurringPromptDue(
        { subscription: "free", createdAt: joined, subscriptionPromptLastShownAt: null },
        new Date("2026-01-08T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is false within 7 days of last dismiss", () => {
    expect(
      isRecurringPromptDue(
        {
          subscription: "free",
          createdAt: joined,
          subscriptionPromptLastShownAt: new Date("2026-01-08T12:00:00.000Z"),
        },
        new Date("2026-01-14T12:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is true again 7+ days after dismiss", () => {
    expect(
      isRecurringPromptDue(
        {
          subscription: "free",
          createdAt: joined,
          subscriptionPromptLastShownAt: new Date("2026-01-08T12:00:00.000Z"),
        },
        new Date("2026-01-15T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is never due for subscribed users", () => {
    expect(
      isRecurringPromptDue(
        { subscription: "premium", createdAt: joined, subscriptionPromptLastShownAt: null },
        new Date("2026-02-01T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("recurringPromptStatus", () => {
  it("returns joined days and due flag together", () => {
    const status = recurringPromptStatus(
      { subscription: "free", createdAt: joined, subscriptionPromptLastShownAt: null },
      new Date("2026-01-15T12:00:00.000Z"),
    );
    expect(status.daysSinceJoined).toBe(14);
    expect(status.recurringPromptDue).toBe(true);
  });
});
