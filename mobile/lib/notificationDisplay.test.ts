import { describe, expect, it } from "vitest";
import { notificationPostPreview, notificationSubtitle, notificationTitle } from "./notificationDisplay";

describe("notificationTitle", () => {
  it("includes actor username for prayer notifications", () => {
    expect(
      notificationTitle({
        type: "prayer",
        actorUsername: "terrencewashington98",
        message: "Someone prayed for you",
      } as never),
    ).toBe("terrencewashington98 prayed with you");
  });
});

describe("notificationSubtitle", () => {
  it("does not repeat prayer copy under the title", () => {
    expect(
      notificationSubtitle({
        type: "prayer",
        message: "Someone prayed for you",
      } as never),
    ).toBeNull();
  });

  it("uses library copy for saves", () => {
    expect(
      notificationSubtitle({
        type: "saved",
        message: "saved your prayer to their library.",
      } as never),
    ).toBe("Added to their saved prayers");
  });
});

describe("notificationPostPreview", () => {
  it("hides media-only placeholders", () => {
    expect(
      notificationPostPreview({
        type: "prayer",
        postPreview: "(Image)",
      } as never),
    ).toBeNull();
  });

  it("keeps real prayer text", () => {
    expect(
      notificationPostPreview({
        type: "prayer",
        postPreview: "Please pray for my family",
      } as never),
    ).toBe("Please pray for my family");
  });
});
