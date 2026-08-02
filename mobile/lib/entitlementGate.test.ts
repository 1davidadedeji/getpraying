import { describe, expect, it } from "vitest";
import {
  deferredNavigationReady,
  entitlementGateIsLoading,
  userNeedsEntitlementGate,
} from "./entitlementGate";

const rc = { enabled: true, isReady: false, isEntitled: false };

describe("entitlementGate (freemium)", () => {
  it("never blocks non-subscribers", () => {
    const user = { isEmailVerified: true, role: "user" } as never;
    expect(userNeedsEntitlementGate(user, rc, "/post/1", ["post"])).toBe(false);
  });

  it("never shows gate loading splash", () => {
    const user = { isEmailVerified: true, role: "user" } as never;
    expect(entitlementGateIsLoading(user, rc, "/post/1", ["post"])).toBe(false);
  });

  it("allows deferred navigation when verified", () => {
    expect(deferredNavigationReady({ isEmailVerified: true, role: "user" } as never, false)).toBe(true);
  });

  it("waits for auth before deferred navigation", () => {
    expect(deferredNavigationReady({ isEmailVerified: true, role: "user" } as never, true)).toBe(false);
  });
});
