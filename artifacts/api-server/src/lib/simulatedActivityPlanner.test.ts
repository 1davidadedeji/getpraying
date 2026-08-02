import { describe, expect, it } from "vitest";
import {
  dayWindowMs,
  pickDailyPosters,
} from "./simulatedActivityPlannerLogic";
import type { SeedUserRow } from "./seedUsers";

function mockSeedUsers(n: number): SeedUserRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    username: `seed${i + 1}`,
    email: `seed${i + 1}@seed.getpraying.app`,
  }));
}

describe("pickDailyPosters", () => {
  it("chooses between 15 and 25 posters when enough seed users exist", () => {
    const users = mockSeedUsers(50);
    const posters = pickDailyPosters(users, []);
    expect(posters.length).toBeGreaterThanOrEqual(15);
    expect(posters.length).toBeLessThanOrEqual(25);
  });

  it("avoids yesterday's poster ids when possible", () => {
    const users = mockSeedUsers(40);
    const previous = users.slice(0, 20).map((u) => u.id);
    const posters = pickDailyPosters(users, previous);
    const overlap = posters.filter((p) => previous.includes(p.id));
    expect(overlap.length).toBeLessThan(posters.length);
  });
});

describe("dayWindowMs", () => {
  it("returns a valid window for a plan date", () => {
    const { startMs, endMs } = dayWindowMs("2026-08-02");
    expect(endMs).toBeGreaterThan(startMs);
    expect(endMs - startMs).toBeGreaterThan(10 * 60 * 60 * 1000);
  });
});
