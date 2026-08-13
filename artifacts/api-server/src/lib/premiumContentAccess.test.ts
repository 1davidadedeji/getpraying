import { describe, expect, it } from "vitest";
import { applyPremiumOfficialForViewer, applyPremiumPostForViewer } from "./premiumContentAccess";

describe("applyPremiumOfficialForViewer", () => {
  it("marks contentLocked for premium guides even when body is empty", () => {
    const out = applyPremiumOfficialForViewer(
      { isPremium: true, content: "", audioUrl: "https://cdn/audio.mp3" },
      { subscription: "free" },
    );
    expect(out.contentLocked).toBe(true);
    expect(out.audioUrl).toBeNull();
  });

  it("leaves premium guides untouched for subscribers", () => {
    const item = { isPremium: true, content: "Full guide", audioUrl: "https://cdn/a.mp3" };
    expect(applyPremiumOfficialForViewer(item, { subscription: "premium" })).toEqual(item);
  });
});

describe("applyPremiumPostForViewer", () => {
  it("marks contentLocked for premium posts for free viewers", () => {
    const out = applyPremiumPostForViewer(
      { isPremium: true, content: "Short", mediaType: "image", mediaUrl: "https://cdn/img.jpg" },
      { subscription: "free" },
    );
    expect(out.contentLocked).toBe(true);
    expect(out.mediaUrl).toBe("https://cdn/img.jpg");
  });

  it("strips video media for free viewers", () => {
    const out = applyPremiumPostForViewer(
      { isPremium: true, content: "Watch this", mediaType: "video", mediaUrl: "https://cdn/v.mp4" },
      { subscription: "free" },
    );
    expect(out.contentLocked).toBe(true);
    expect(out.mediaUrl).toBeNull();
  });

  it("leaves premium posts untouched for the author", () => {
    const item = {
      isPremium: true,
      content: "My premium prayer",
      mediaType: "audio",
      mediaUrl: "https://cdn/a.mp3",
    };
    const out = applyPremiumPostForViewer(item, { subscription: "free" }, { viewerUserId: 7, authorId: 7 });
    expect(out).toEqual(item);
  });
});
