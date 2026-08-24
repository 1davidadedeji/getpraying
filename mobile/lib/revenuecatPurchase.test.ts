import { describe, expect, it } from "vitest";
import { purchaseErrorMessage } from "./revenuecatPurchase";

describe("purchaseErrorMessage", () => {
  it("explains Google Play billing when the APK was not installed from Play", () => {
    const msg = purchaseErrorMessage(
      new Error(
        "This version of the application is not configured for billing through Google Play. Check the help center for more information.",
      ),
      "Purchase cancelled or failed.",
    );
    expect(msg.toLowerCase()).toContain("google play");
    expect(msg.toLowerCase()).toMatch(/install|testing track|play store/);
  });

  it("explains invalid Play product arguments without repeating the raw store sentence alone", () => {
    const msg = purchaseErrorMessage(
      new Error("Could not start subscription: one or more of the arguments provided are invalid"),
      "Purchase cancelled or failed.",
    );
    expect(msg.toLowerCase()).toMatch(/product|plan|play/);
  });
});
