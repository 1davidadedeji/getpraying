import { describe, expect, it } from "vitest";
import {
  detectCommentTheme,
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

  it("pickContentLengthTier returns valid tiers", () => {
    const tiers = new Set(Array.from({ length: 40 }, () => pickContentLengthTier()));
    expect(tiers.has("short")).toBe(true);
    expect(tiers.has("normal")).toBe(true);
    expect(tiers.has("long")).toBe(true);
  });

  it("detectCommentTheme maps healing / surgery language", () => {
    expect(detectCommentTheme("My mom is recovering after surgery this week.")).toBe("healing");
  });

  it("detectCommentTheme maps work / career language", () => {
    expect(detectCommentTheme("Big interview at work tomorrow — need wisdom.")).toBe("work");
  });

  it("detectCommentTheme maps anxiety / worry language", () => {
    expect(detectCommentTheme("My mind won't quiet down and the anxiety is heavy.")).toBe("anxiety");
  });

  it("pickSimulatedComment reflects healing posts", () => {
    const post = "Please pray for my friend's recovery after surgery.";
    const samples = Array.from({ length: 20 }, () => pickSimulatedComment(post, "normal"));
    expect(samples.every((c) => c.length > 3)).toBe(true);
    expect(
      samples.some((c) => /heal|recover|surgery|strength|care/i.test(c)),
    ).toBe(true);
    expect(samples.every((c) => !/^Amen\.?$/i.test(c.trim()))).toBe(true);
    expect(samples.every((c) => c !== "Praying for you.")).toBe(true);
  });

  it("pickSimulatedComment reflects work posts", () => {
    const post = "Stressful job decision this month — pray for clarity at work.";
    const samples = Array.from({ length: 20 }, () => pickSimulatedComment(post, "normal"));
    expect(
      samples.some((c) => /work|job|career|decision|clarity|door/i.test(c)),
    ).toBe(true);
  });

  it("pickSimulatedComment short tier stays brief but specific", () => {
    const post = "Couldn't sleep — anxiety about everything going on.";
    const comment = pickSimulatedComment(post, "short");
    expect(comment.length).toBeGreaterThan(8);
    expect(comment.length).toBeLessThan(60);
    expect(/^Amen\.?$/i.test(comment.trim())).toBe(false);
  });
});
