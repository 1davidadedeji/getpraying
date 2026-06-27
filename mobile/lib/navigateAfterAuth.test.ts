import { describe, expect, it } from "vitest";
import type { Href } from "expo-router";
import { HARD_PAYWALL_ROUTE, isHardPaywallRoute } from "./navigateAfterAuth";

describe("isHardPaywallRoute", () => {
  it("matches the hard paywall route", () => {
    expect(isHardPaywallRoute(HARD_PAYWALL_ROUTE as Href)).toBe(true);
    expect(isHardPaywallRoute("/(paywall)" as Href)).toBe(true);
  });

  it("does not match other post-auth routes", () => {
    expect(isHardPaywallRoute("/(tabs)" as Href)).toBe(false);
    expect(isHardPaywallRoute("/onboarding" as Href)).toBe(false);
    expect(isHardPaywallRoute("/(auth)/verify" as Href)).toBe(false);
    // Soft paywall (upsell) is a different surface and must NOT be treated as the gate.
    expect(isHardPaywallRoute("/(paywall)?soft=1" as Href)).toBe(false);
  });

  it("handles null/undefined", () => {
    expect(isHardPaywallRoute(null)).toBe(false);
    expect(isHardPaywallRoute(undefined)).toBe(false);
  });
});
