import { describe, expect, it, vi } from "vitest";
import { restorePurchasesWithFeedback } from "./restorePurchases";

describe("restorePurchasesWithFeedback", () => {
  it("returns not available when RevenueCat is disabled", async () => {
    const result = await restorePurchasesWithFeedback({
      restore: vi.fn(),
      user: null,
      rc: { enabled: false, customerInfo: null },
    });
    expect(result.ok).toBe(false);
    expect(result.title).toBe("Not available");
  });

  it("returns success when restore yields an active entitlement", async () => {
    const result = await restorePurchasesWithFeedback({
      restore: async () =>
        ({
          entitlements: { active: { premium: { identifier: "premium" } } },
        }) as never,
      user: { subscription: "free" } as never,
      rc: { enabled: true, customerInfo: null },
    });
    expect(result.ok).toBe(true);
    expect(result.title).toBe("Purchases restored");
  });
});
