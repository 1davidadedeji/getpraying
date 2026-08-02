import { describe, expect, it } from "vitest";
import { isSubscribed } from "./subscriptionAccess";

describe("isSubscribed", () => {
  it("is true for premium and legacy trial server tiers", () => {
    expect(isSubscribed({ subscription: "premium" } as never)).toBe(true);
    expect(isSubscribed({ subscription: "trial" } as never)).toBe(true);
  });

  it("is false for free tier without store entitlement", () => {
    expect(isSubscribed({ subscription: "free", role: "user" } as never, { enabled: true, customerInfo: null })).toBe(
      false,
    );
  });

  it("is true for admins regardless of tier", () => {
    expect(isSubscribed({ role: "admin", subscription: "free" } as never)).toBe(true);
  });
});
