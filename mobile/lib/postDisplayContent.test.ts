import { describe, expect, it } from "vitest";
import { postTextForDisplay } from "./postDisplayContent";

describe("postTextForDisplay", () => {
  it("hides legacy (Image) on audio posts", () => {
    expect(
      postTextForDisplay("(Image)", {
        mediaUrl: "https://cdn/a.mp3",
        mediaType: "audio",
      }),
    ).toBe("");
  });

  it("keeps user-written captions", () => {
    expect(postTextForDisplay("Hold this in prayer")).toBe("Hold this in prayer");
  });

  it("hides empty content when media is attached", () => {
    expect(
      postTextForDisplay("", {
        mediaUrl: "https://cdn/v.mp4",
        mediaType: "video",
      }),
    ).toBe("");
  });
});
