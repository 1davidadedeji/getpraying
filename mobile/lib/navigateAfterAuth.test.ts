import { describe, expect, it } from "vitest";
import type { Href } from "expo-router";
import type { User } from "@workspace/api-client-react";
import { getPostAuthRoute, isHardPaywallRoute } from "./navigateAfterAuth";

const rc = { enabled: true, isReady: true, isEntitled: false };

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: "a@b.com",
    username: "user1",
    role: "user",
    isEmailVerified: true,
    onboardingComplete: true,
    subscription: "free",
    preferredCategories: [],
    prayersShared: 0,
    prayedFor: 0,
    savedScrolls: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe("getPostAuthRoute (freemium)", () => {
  it("routes unverified users to verify", () => {
    expect(getPostAuthRoute(user({ isEmailVerified: false }), rc, null)).toBe("/(auth)/verify");
  });

  it("routes verified free users to tabs without paywall", () => {
    expect(getPostAuthRoute(user(), rc, null)).toBe("/(tabs)");
  });

  it("routes to onboarding when categories not set", () => {
    expect(getPostAuthRoute(user({ onboardingComplete: false }), rc, null)).toBe("/onboarding");
  });

  it("does not wait on RevenueCat — free user reaches tabs even when RC not ready", () => {
    const rcPending = { enabled: true, isReady: false, isEntitled: false };
    expect(getPostAuthRoute(user(), rcPending, null)).toBe("/(tabs)");
  });

  it("does not route to paywall for non-subscribers", () => {
    const route = getPostAuthRoute(user({ subscription: "free" }), rc, null);
    expect(String(route)).not.toContain("paywall");
  });
});

describe("isHardPaywallRoute", () => {
  it("always false — hard paywall removed", () => {
    expect(isHardPaywallRoute("/(paywall)" as Href)).toBe(false);
    expect(isHardPaywallRoute("/(tabs)" as Href)).toBe(false);
    expect(isHardPaywallRoute(null)).toBe(false);
  });
});
