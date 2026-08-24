import { describe, expect, it } from "vitest";
import { shouldPersonalizeFeed } from "./feedPersonalize";

describe("shouldPersonalizeFeed", () => {
  it("personalizes signed-in home feed by default (affinity ranking, not a separate ML model)", () => {
    expect(shouldPersonalizeFeed({ isSignedIn: true, queryValue: undefined })).toBe(true);
    expect(shouldPersonalizeFeed({ isSignedIn: true, queryValue: "true" })).toBe(true);
  });

  it("uses latest-only ranking when personalize=false", () => {
    expect(shouldPersonalizeFeed({ isSignedIn: true, queryValue: "false" })).toBe(false);
  });

  it("does not personalize logged-out feeds", () => {
    expect(shouldPersonalizeFeed({ isSignedIn: false, queryValue: "true" })).toBe(false);
  });
});
