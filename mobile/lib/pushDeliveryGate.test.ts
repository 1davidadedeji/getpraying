import { describe, expect, it, beforeEach } from "vitest";
import { isPushDeliveryEnabled, setPushDeliveryEnabled } from "./pushDeliveryGate";

describe("push delivery gate", () => {
  beforeEach(() => {
    setPushDeliveryEnabled(false);
  });

  it("defaults to disabled until auth enables delivery", () => {
    expect(isPushDeliveryEnabled()).toBe(false);
  });

  it("enables delivery when user is signed in", () => {
    setPushDeliveryEnabled(true);
    expect(isPushDeliveryEnabled()).toBe(true);
  });

  it("disables delivery on logout", () => {
    setPushDeliveryEnabled(true);
    setPushDeliveryEnabled(false);
    expect(isPushDeliveryEnabled()).toBe(false);
  });
});
