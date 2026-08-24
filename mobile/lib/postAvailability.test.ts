import { describe, expect, it } from "vitest";
import { shouldMarkPostUnavailableFromComments } from "./postAvailability";

describe("shouldMarkPostUnavailableFromComments", () => {
  it("does not treat a comments 404 as a deleted post when the post already loaded", () => {
    expect(shouldMarkPostUnavailableFromComments(404, true)).toBe(false);
  });

  it("marks the post unavailable when comments 404 and no post body loaded", () => {
    expect(shouldMarkPostUnavailableFromComments(404, false)).toBe(true);
  });

  it("ignores non-404 comment failures", () => {
    expect(shouldMarkPostUnavailableFromComments(500, false)).toBe(false);
    expect(shouldMarkPostUnavailableFromComments(200, true)).toBe(false);
  });
});
