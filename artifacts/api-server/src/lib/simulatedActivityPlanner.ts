import { db, postsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadSeedUsers } from "./seedUsers";
import {
  enqueueSimulatedJobs,
  getDailyPlan,
  isSimulatedActivityEnabled,
  postAlreadyHasEngagementJobs,
  setDailyPlan,
} from "./simulatedActivityJobs";
import {
  buildDailyPostJobs,
  buildEngagementJobs,
  dayWindowMs,
  pickDailyPosters,
  todayPlanDate,
} from "./simulatedActivityPlannerLogic";

export {
  dayWindowMs,
  pickDailyPosters,
  buildEngagementJobs,
} from "./simulatedActivityPlannerLogic";

export async function planDailySimulatedPosts(now = new Date()): Promise<number> {
  if (!isSimulatedActivityEnabled()) return 0;

  const date = todayPlanDate(now);
  const existing = await getDailyPlan();
  if (existing?.date === date) return 0;

  const seedUsers = await loadSeedUsers();
  if (seedUsers.length < 5) return 0;

  const previousPosterIds = existing?.posterIds ?? [];
  const posters = pickDailyPosters(seedUsers, previousPosterIds);
  const { startMs, endMs } = dayWindowMs(date);
  const windowStart = Math.max(startMs, now.getTime());
  const windowEnd = Math.max(windowStart + 60_000, endMs);

  const jobs = buildDailyPostJobs(posters, windowStart, windowEnd);
  await enqueueSimulatedJobs(jobs);
  await setDailyPlan({
    date,
    posterIds: posters.map((p) => p.id),
    postCount: posters.length,
  });

  return jobs.length;
}

export async function scheduleEngagementForPost(
  postId: number,
  authorId: number | null,
  realUserPost: boolean,
): Promise<number> {
  if (!isSimulatedActivityEnabled()) return 0;

  const [post] = await db
    .select({ isPremium: postsTable.isPremium })
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);
  if (post?.isPremium) return 0;

  if (realUserPost && (await postAlreadyHasEngagementJobs(postId))) return 0;
  const seedUsers = await loadSeedUsers();
  const jobs = buildEngagementJobs(postId, authorId, seedUsers, realUserPost);
  await enqueueSimulatedJobs(jobs);
  return jobs.length;
}

export async function scheduleEngagementForRealUserPost(
  postId: number,
  authorId: number,
): Promise<number> {
  return scheduleEngagementForPost(postId, authorId, true);
}
