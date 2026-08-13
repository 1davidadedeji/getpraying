import { describe, expect, it } from "vitest";
import { isMediaOnlyPostContent } from "./postContentDisplay";

describe("isMediaOnlyPostContent", () => {
  it("recognizes legacy and typed media-only markers", () => {
    expect(isMediaOnlyPostContent("(Image)")).toBe(true);
    expect(isMediaOnlyPostContent("(Audio)")).toBe(true);
    expect(isMediaOnlyPostContent("(Video)")).toBe(true);
  });

  it("returns false for real captions", () => {
    expect(isMediaOnlyPostContent("Please pray for my family")).toBe(false);
    expect(isMediaOnlyPostContent("")).toBe(false);
  });
});
