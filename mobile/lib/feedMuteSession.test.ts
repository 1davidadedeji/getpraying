import { describe, expect, it, beforeEach } from "vitest";
import {
  getFeedAudioUnlocked,
  resetFeedAudioUnlocked,
  setFeedAudioUnlocked,
} from "./feedMuteSession";

describe("feedMuteSession", () => {
  beforeEach(() => {
    resetFeedAudioUnlocked();
  });

  it("starts muted and stays unmuted for the rest of the session once unlocked", () => {
    expect(getFeedAudioUnlocked()).toBe(false);
    setFeedAudioUnlocked(true);
    expect(getFeedAudioUnlocked()).toBe(true);
    setFeedAudioUnlocked(true);
    expect(getFeedAudioUnlocked()).toBe(true);
    setFeedAudioUnlocked(false);
    expect(getFeedAudioUnlocked()).toBe(false);
  });
});
