import { describe, expect, it } from "vitest";
import { inDeliveryWindow, notSentTodayLocal } from "./scheduledNotificationTime";

describe("notSentTodayLocal", () => {
  it("returns true when never sent", () => {
    expect(notSentTodayLocal(null, "America/New_York")).toBe(true);
  });

  it("returns false when sent earlier today in user timezone", () => {
    const now = new Date();
    expect(notSentTodayLocal(now, "UTC")).toBe(false);
  });

  it("returns true when sent on a previous calendar day in user timezone", () => {
    const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(notSentTodayLocal(yesterday, "UTC")).toBe(true);
  });
});

describe("inDeliveryWindow", () => {
  it("allows retries through minute 29", () => {
    expect(inDeliveryWindow({ hour: 8, minute: 25 }, 8, 29)).toBe(true);
    expect(inDeliveryWindow({ hour: 8, minute: 30 }, 8, 29)).toBe(false);
  });
});
