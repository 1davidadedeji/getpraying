import { describe, expect, it } from "vitest";
import { applyPremiumOfficialForViewer, applyPremiumPostForViewer, transformLibraryPayloadForViewer } from "./premiumContentAccess";

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

  it("leaves morning/evening sanctuary guides free for all viewers", () => {
    const item = {
      isPremium: true,
      scheduleSlot: "morning",
      content: "Morning prayer",
      audioUrl: "https://cdn/a.mp3",
    };
    expect(applyPremiumOfficialForViewer(item, { subscription: "free" })).toEqual(item);
  });

  it("leaves legacy sanctuary category guides free for all viewers", () => {
    const item = {
      isPremium: true,
      category: "sanctuary",
      content: "Morning prayer",
      audioUrl: "https://cdn/a.mp3",
    };
    expect(applyPremiumOfficialForViewer(item, { subscription: "free" })).toEqual(item);
  });
});

describe("transformLibraryPayloadForViewer", () => {
  it("keeps sanctuary slot audio for free viewers", () => {
    const body = {
      morning: {
        isPremium: true,
        scheduleSlot: "morning",
        content: "Morning prayer",
        audioUrl: "https://cdn/morning.mp3",
      },
      evening: {
        isPremium: true,
        scheduleSlot: "evening",
        content: "Evening prayer",
        audioUrl: "https://cdn/evening.mp3",
      },
    };
    const out = transformLibraryPayloadForViewer(body, { subscription: "free" }) as typeof body;
    expect(out.morning.audioUrl).toBe("https://cdn/morning.mp3");
    expect(out.evening.audioUrl).toBe("https://cdn/evening.mp3");
    expect((out.morning as { contentLocked?: boolean }).contentLocked).toBeUndefined();
  });

  it("strips premium path guides for free viewers", () => {
    const body = {
      id: 58,
      name: "Anxiety",
      officialPrayers: [
        {
          isPremium: true,
          content: "Long path guide body",
          audioUrl: "https://cdn/a.mp3",
        },
      ],
    };
    const out = transformLibraryPayloadForViewer(body, { subscription: "free" }) as typeof body;
    expect((out.officialPrayers[0] as { contentLocked?: boolean })?.contentLocked).toBe(true);
    expect(out.officialPrayers[0]?.audioUrl).toBeNull();
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
