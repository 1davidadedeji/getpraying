import { describe, expect, it } from "vitest";
import {
  parseUserId,
  subscriptionFromEvent,
  verifyRevenueCatWebhookSecret,
} from "./revenuecatWebhook";

describe("parseUserId", () => {
  it("parses positive integer app user ids", () => {
    expect(parseUserId("42")).toBe(42);
    expect(parseUserId("  7  ")).toBe(7);
  });

  it("rejects invalid app user ids", () => {
    expect(parseUserId(undefined)).toBeNull();
    expect(parseUserId("")).toBeNull();
    expect(parseUserId("0")).toBeNull();
    expect(parseUserId("-1")).toBeNull();
    expect(parseUserId("abc")).toBeNull();
    expect(parseUserId("12.5")).toBe(12);
  });
});

describe("subscriptionFromEvent", () => {
  describe("INITIAL_PURCHASE", () => {
    it('defaults to "trial" when period_type is missing', () => {
      expect(subscriptionFromEvent("INITIAL_PURCHASE", undefined)).toBe("trial");
    });

    it('defaults to "trial" when period_type is empty', () => {
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "")).toBe("trial");
    });

    it('maps explicit TRIAL period_type to "trial"', () => {
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "TRIAL")).toBe("trial");
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "trial")).toBe("trial");
    });

    it('maps explicit INTRO period_type to "trial"', () => {
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "INTRO")).toBe("trial");
    });

    it('maps paid period_type to "premium"', () => {
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "NORMAL")).toBe("premium");
      expect(subscriptionFromEvent("INITIAL_PURCHASE", "PREPAID")).toBe("premium");
    });
  });

  describe("PRODUCT_CHANGE", () => {
    it('defaults to "trial" when period_type is missing', () => {
      expect(subscriptionFromEvent("PRODUCT_CHANGE", undefined)).toBe("trial");
    });

    it('defaults to "trial" when period_type is empty', () => {
      expect(subscriptionFromEvent("PRODUCT_CHANGE", "")).toBe("trial");
    });

    it('maps explicit TRIAL period_type to "trial"', () => {
      expect(subscriptionFromEvent("PRODUCT_CHANGE", "TRIAL")).toBe("trial");
    });

    it('maps paid period_type to "premium"', () => {
      expect(subscriptionFromEvent("PRODUCT_CHANGE", "NORMAL")).toBe("premium");
    });
  });

  describe("standard premium transitions", () => {
    it('maps RENEWAL without period_type to "premium"', () => {
      expect(subscriptionFromEvent("RENEWAL", undefined)).toBe("premium");
    });

    it('maps RENEWAL with paid period to "premium"', () => {
      expect(subscriptionFromEvent("RENEWAL", "NORMAL")).toBe("premium");
    });

    it('maps RENEWAL during trial period to "trial"', () => {
      expect(subscriptionFromEvent("RENEWAL", "TRIAL")).toBe("trial");
    });

    it('maps UNCANCELLATION to "premium" when not in trial', () => {
      expect(subscriptionFromEvent("UNCANCELLATION", "NORMAL")).toBe("premium");
      expect(subscriptionFromEvent("UNCANCELLATION", undefined)).toBe("premium");
    });

    it('maps UNCANCELLATION during trial to "trial"', () => {
      expect(subscriptionFromEvent("UNCANCELLATION", "TRIAL")).toBe("trial");
    });
  });

  describe("cancellations, billing issues, and expirations", () => {
    it('ignores CANCELLATION (auto-renew off; access continues until EXPIRATION)', () => {
      // Must NOT downgrade — the user keeps paid/trial access until the period ends.
      expect(subscriptionFromEvent("CANCELLATION", undefined)).toBeNull();
      expect(subscriptionFromEvent("CANCELLATION", "NORMAL")).toBeNull();
      expect(subscriptionFromEvent("CANCELLATION", "TRIAL")).toBeNull();
    });

    it('ignores BILLING_ISSUE (grace/retry period; access continues)', () => {
      expect(subscriptionFromEvent("BILLING_ISSUE", undefined)).toBeNull();
      expect(subscriptionFromEvent("BILLING_ISSUE", "NORMAL")).toBeNull();
    });

    it('maps EXPIRATION to "free" (access has actually lapsed)', () => {
      expect(subscriptionFromEvent("EXPIRATION", undefined)).toBe("free");
      expect(subscriptionFromEvent("EXPIRATION", "TRIAL")).toBe("free");
      expect(subscriptionFromEvent("EXPIRATION", "NORMAL")).toBe("free");
    });
  });

  describe("ignored events", () => {
    it("returns null for unhandled RevenueCat event types", () => {
      expect(subscriptionFromEvent("SUBSCRIBER_ALIAS", undefined)).toBeNull();
      expect(subscriptionFromEvent("TRANSFER", "NORMAL")).toBeNull();
      expect(subscriptionFromEvent("TEST", undefined)).toBeNull();
    });
  });
});

describe("verifyRevenueCatWebhookSecret", () => {
  it("accepts matching bearer tokens", () => {
    expect(verifyRevenueCatWebhookSecret("Bearer secret-123", "secret-123")).toBe("ok");
  });

  it("rejects missing or wrong authorization", () => {
    expect(verifyRevenueCatWebhookSecret(undefined, "secret-123")).toBe("unauthorized");
    expect(verifyRevenueCatWebhookSecret("Bearer wrong", "secret-123")).toBe("unauthorized");
    expect(verifyRevenueCatWebhookSecret("secret-123", "secret-123")).toBe("unauthorized");
  });

  it("reports not configured when secret env is unset", () => {
    expect(verifyRevenueCatWebhookSecret("Bearer x", undefined)).toBe("not_configured");
    expect(verifyRevenueCatWebhookSecret("Bearer x", "   ")).toBe("not_configured");
  });
});
