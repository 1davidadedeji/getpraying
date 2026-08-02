import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { claimDueSimulatedJobs, isSimulatedActivityEnabled } from "./simulatedActivityJobs";
import { planDailySimulatedPosts } from "./simulatedActivityPlanner";
import { executeSimulatedActivityJob } from "./simulatedActivityExecutor";

const CHECK_INTERVAL_MS = 3 * 60 * 1000;
const SIMULATED_ACTIVITY_ADVISORY_LOCK_KEY = 0x475054520002;

let runInFlight = false;

function parseTryLockResult(result: unknown): boolean {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === "object" && "rows" in result
      ? (result as { rows: unknown[] }).rows
      : [];
  return (rows[0] as { locked?: boolean } | undefined)?.locked === true;
}

async function tryAcquireSchedulerLock(): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT pg_try_advisory_lock(${SIMULATED_ACTIVITY_ADVISORY_LOCK_KEY}) AS locked`,
  );
  return parseTryLockResult(result);
}

async function releaseSchedulerLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${SIMULATED_ACTIVITY_ADVISORY_LOCK_KEY})`);
}

async function runSimulatedActivityTick(): Promise<void> {
  if (!isSimulatedActivityEnabled()) return;
  if (runInFlight) return;
  runInFlight = true;

  const locked = await tryAcquireSchedulerLock();
  if (!locked) {
    runInFlight = false;
    return;
  }

  try {
    const planned = await planDailySimulatedPosts();
    if (planned > 0) {
      console.info(`[simulated-activity] Planned ${planned} seed posts for today`);
    }

    const jobs = await claimDueSimulatedJobs(50);
    for (const job of jobs) {
      await executeSimulatedActivityJob(job);
    }
    if (jobs.length > 0) {
      console.info(`[simulated-activity] Executed ${jobs.length} job(s)`);
    }
  } catch (err) {
    console.warn("[simulated-activity] tick error:", err);
  } finally {
    await releaseSchedulerLock().catch(() => {});
    runInFlight = false;
  }
}

export function startSimulatedActivityScheduler(): void {
  if (!isSimulatedActivityEnabled()) {
    console.info("[simulated-activity] Disabled (SIMULATED_ACTIVITY_ENABLED=false)");
    return;
  }
  setTimeout(() => void runSimulatedActivityTick(), 30_000);
  setInterval(() => void runSimulatedActivityTick(), CHECK_INTERVAL_MS);
  console.info(
    `[simulated-activity] Scheduler started (every ${CHECK_INTERVAL_MS / 60_000} min)`,
  );
}

export async function maybeScheduleRealUserPostEngagement(
  postId: number,
  authorId: number | null | undefined,
): Promise<void> {
  if (!isSimulatedActivityEnabled() || !authorId) return;
  const { isSeedUserId, loadSeedUsers } = await import("./seedUsers");
  if (await isSeedUserId(authorId)) return;
  const seedUsers = await loadSeedUsers();
  if (seedUsers.length === 0) return;
  const { scheduleEngagementForRealUserPost } = await import("./simulatedActivityPlanner");
  const n = await scheduleEngagementForRealUserPost(postId, authorId);
  if (n > 0) {
    console.info(`[simulated-activity] Queued ${n} engagement job(s) for real user post ${postId}`);
  }
}
