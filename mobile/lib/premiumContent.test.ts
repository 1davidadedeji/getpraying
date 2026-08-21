import { describe, expect, it } from "vitest";
import {
  isPremiumContentLocked,
  isPremiumMediaLocked,
  isSanctuaryOfficialPrayer,
  shouldBlurOfficialForViewer,
  shouldBlurPremiumForViewer,
  shouldBlurPremiumPostForViewer,
} from "./premiumContent";

describe("isPremiumContentLocked", () => {
  it("returns true when premium and locked", () => {
    expect(isPremiumContentLocked({ isPremium: true, contentLocked: true })).toBe(true);
  });

  it("returns false for subscribers or free content", () => {
    expect(isPremiumContentLocked({ isPremium: true, contentLocked: false })).toBe(false);
    expect(isPremiumContentLocked({ isPremium: false, contentLocked: true })).toBe(false);
  });
});

describe("isPremiumMediaLocked", () => {
  it("detects stripped video/audio for premium posts", () => {
    expect(
      isPremiumMediaLocked({ isPremium: true, mediaType: "video", mediaUrl: null }),
    ).toBe(true);
    expect(
      isPremiumMediaLocked({ isPremium: true, mediaType: "audio", mediaUrl: "" }),
    ).toBe(true);
  });

  it("ignores images and subscribed playback", () => {
    expect(
      isPremiumMediaLocked({ isPremium: true, mediaType: "image", mediaUrl: null }),
    ).toBe(false);
    expect(
      isPremiumMediaLocked({ isPremium: true, mediaType: "video", mediaUrl: "https://x/v.mp4" }),
    ).toBe(false);
  });
});

describe("shouldBlurOfficialForViewer", () => {
  it("never blurs morning/evening sanctuary guides", () => {
    expect(
      shouldBlurOfficialForViewer({ isPremium: true, scheduleSlot: "morning" }, false),
    ).toBe(false);
    expect(
      shouldBlurOfficialForViewer({ isPremium: true, scheduleSlot: "evening" }, false),
    ).toBe(false);
  });

  it("blurs other premium official guides for free viewers", () => {
    expect(shouldBlurOfficialForViewer({ isPremium: true, scheduleSlot: null }, false)).toBe(true);
  });
});

describe("isSanctuaryOfficialPrayer", () => {
  it("detects morning and evening slots", () => {
    expect(isSanctuaryOfficialPrayer({ scheduleSlot: "morning" })).toBe(true);
    expect(isSanctuaryOfficialPrayer({ scheduleSlot: " EVENING " })).toBe(true);
    expect(isSanctuaryOfficialPrayer({ scheduleSlot: "lectures" })).toBe(false);
  });
});

describe("shouldBlurPremiumForViewer", () => {
  it("blurs premium content for free viewers", () => {
    expect(shouldBlurPremiumForViewer({ isPremium: true }, false)).toBe(true);
  });

  it("does not blur free content", () => {
    expect(shouldBlurPremiumForViewer({ isPremium: false }, false)).toBe(false);
  });

  it("does not blur premium content for subscribers", () => {
    expect(shouldBlurPremiumForViewer({ isPremium: true }, true)).toBe(false);
  });
});

describe("shouldBlurPremiumPostForViewer", () => {
  it("does not blur for the post author", () => {
    expect(
      shouldBlurPremiumPostForViewer({ isPremium: true, authorId: 3 }, false, 3),
    ).toBe(false);
  });

  it("blurs for other free viewers", () => {
    expect(
      shouldBlurPremiumPostForViewer({ isPremium: true, authorId: 3 }, false, 9),
    ).toBe(true);
  });
});
