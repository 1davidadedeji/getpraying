import { describe, expect, it } from "vitest";
import { engagementCountForPost, pickSimulatedComment } from "./simulatedPrayerContent";
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
    expect(pickSimulatedComment().length).toBeGreaterThan(10);
  });
});
