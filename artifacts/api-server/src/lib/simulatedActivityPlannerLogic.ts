import type { SeedUserRow } from "./seedUsers";
import {
  pickEngagementAction,
  pickN,
  randInt,
  randomTimeBetween,
  type EngagementAction,
} from "./simulatedActivityRandom";
import { engagementCountForPost, engagementDelayMs } from "./simulatedPrayerContent";
import type { SimulatedJobPayload } from "./simulatedActivityJobs";

export type SimulatedActivityAction = "post" | "pray" | "comment" | "save" | "boost";

const PLAN_TIMEZONE = "America/New_York";

export function todayPlanDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: PLAN_TIMEZONE });
}

/** Local day bounds in UTC ms for scheduling posts across waking hours. */
export function dayWindowMs(planDate: string): { startMs: number; endMs: number } {
  const [y, m, d] = planDate.split("-").map(Number);
  const noonUtc = Date.UTC(y!, m! - 1, d!, 17, 0, 0);
  const startMs = noonUtc - 11 * 60 * 60 * 1000;
  const endMs = noonUtc + 6 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export function pickDailyPosters(allSeedUsers: SeedUserRow[], previousPosterIds: number[]): SeedUserRow[] {
  const count = randInt(15, 25);
  const avoid = new Set(previousPosterIds);
  const preferred = allSeedUsers.filter((u) => !avoid.has(u.id));
  const pool = preferred.length >= count ? preferred : allSeedUsers;
  return pickN(pool, count);
}

export function buildDailyPostJobs(
  posters: SeedUserRow[],
  windowStartMs: number,
  windowEndMs: number,
): { executeAt: Date; action: SimulatedActivityAction; payload: SimulatedJobPayload }[] {
  return posters.map((poster) => ({
    executeAt: randomTimeBetween(windowStartMs, windowEndMs),
    action: "post" as const,
    payload: { authorId: poster.id },
  }));
}

export function buildEngagementJobs(
  postId: number,
  authorId: number | null,
  seedUsers: SeedUserRow[],
  realUserPost: boolean,
  baseTime = Date.now(),
): { executeAt: Date; action: SimulatedActivityAction; payload: SimulatedJobPayload }[] {
  const eligible = seedUsers.filter((u) => u.id !== authorId);
  if (eligible.length === 0) return [];

  const count = Math.min(engagementCountForPost(realUserPost), eligible.length);
  const actors = pickN(eligible, count);
  const jobs: { executeAt: Date; action: SimulatedActivityAction; payload: SimulatedJobPayload }[] =
    [];
  let cursor = baseTime;

  for (const actor of actors) {
    cursor += engagementDelayMs(realUserPost) / Math.max(count, 1);
    const action = pickEngagementAction(realUserPost) as EngagementAction;
    jobs.push({
      executeAt: new Date(cursor + randInt(5, 45) * 60_000),
      action,
      payload: {
        postId,
        userId: actor.id,
        realUserPost,
      },
    });
  }
  return jobs;
}
