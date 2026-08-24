import { describe, expect, it } from "vitest";
import { nextFullScreenFeedLoading, shouldSkipSilentFeedPostReload } from "./feedLoadState";

describe("nextFullScreenFeedLoading", () => {
  it("clears the spinner when a silent tab-focus fetch supersedes the initial load", () => {
    let loading = nextFullScreenFeedLoading({
      currentlyLoading: true,
      silent: false,
      isCurrentGeneration: true,
      phase: "start",
    });
    expect(loading).toBe(true);

    loading = nextFullScreenFeedLoading({
      currentlyLoading: loading,
      silent: false,
      isCurrentGeneration: false,
      phase: "settle",
    });
    expect(loading).toBe(true);

    loading = nextFullScreenFeedLoading({
      currentlyLoading: loading,
      silent: true,
      isCurrentGeneration: true,
      phase: "start",
    });
    expect(loading).toBe(true);

    loading = nextFullScreenFeedLoading({
      currentlyLoading: loading,
      silent: true,
      isCurrentGeneration: true,
      phase: "settle",
    });
    expect(loading).toBe(false);
  });
});

describe("shouldSkipSilentFeedPostReload", () => {
  it("skips a silent post reload while the full-screen spinner is already waiting on the first fetch", () => {
    expect(shouldSkipSilentFeedPostReload(true)).toBe(true);
    expect(shouldSkipSilentFeedPostReload(false)).toBe(false);
  });
});
