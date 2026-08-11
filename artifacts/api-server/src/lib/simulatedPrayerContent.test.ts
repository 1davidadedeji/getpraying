import { describe, expect, it } from "vitest";
import {
  engagementCountForPost,
  pickContentLengthTier,
  pickSimulatedComment,
} from "./simulatedPrayerContent";
import { pickEngagementAction, randInt } from "./simulatedActivityRandom";

describe("simulatedActivityRandom", () => {
  it("randInt stays within bounds", () => {
    for (let i = 0; i < 20; i++) {
      const n = randInt(5, 15);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(15);
    }
  });

  it("pickEngagementAction returns valid actions", () => {
    const actions = new Set<string>();
    for (let i = 0; i < 50; i++) {
      actions.add(pickEngagementAction(true));
    }
    expect(actions.has("pray")).toBe(true);
    expect(actions.has("comment")).toBe(true);
  });
});

describe("simulatedPrayerContent", () => {
  it("engagement counts differ for real vs seed posts", () => {
    const realCounts = Array.from({ length: 30 }, () => engagementCountForPost(true));
    const seedCounts = Array.from({ length: 30 }, () => engagementCountForPost(false));
    expect(Math.min(...realCounts)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...realCounts)).toBeLessThanOrEqual(15);
    expect(Math.min(...seedCounts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...seedCounts)).toBeLessThanOrEqual(12);
  });

  it("pickSimulatedComment returns non-empty text", () => {
    expect(pickSimulatedComment().length).toBeGreaterThan(3);
    expect(pickSimulatedComment("long").length).toBeGreaterThan(50);
    expect(pickSimulatedComment("short").length).toBeLessThan(60);
  });

  it("pickContentLengthTier returns valid tiers", () => {
    const tiers = new Set(Array.from({ length: 40 }, () => pickContentLengthTier()));
    expect(tiers.has("short")).toBe(true);
    expect(tiers.has("normal")).toBe(true);
    expect(tiers.has("long")).toBe(true);
  });
});
