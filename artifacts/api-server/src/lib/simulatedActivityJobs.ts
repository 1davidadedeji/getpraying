import {
  appSettingsTable,
  db,
  simulatedActivityJobsTable,
} from "@workspace/db";
import { and, eq, lte, sql } from "drizzle-orm";

export type SimulatedActivityAction = "post" | "pray" | "comment" | "save" | "boost";

export type SimulatedJobPayload = {
  authorId?: number;
  postId?: number;
  userId?: number;
  content?: string;
  realUserPost?: boolean;
  category?: string | null;
};

export function isSimulatedActivityEnabled(): boolean {
  return process.env.SIMULATED_ACTIVITY_ENABLED !== "false";
}

export async function enqueueSimulatedJob(
  executeAt: Date,
  action: SimulatedActivityAction,
  payload: SimulatedJobPayload,
): Promise<void> {
  await db.insert(simulatedActivityJobsTable).values({
    executeAt,
    action,
    payload,
    status: "pending",
  });
}

export async function enqueueSimulatedJobs(
  jobs: { executeAt: Date; action: SimulatedActivityAction; payload: SimulatedJobPayload }[],
): Promise<void> {
  if (jobs.length === 0) return;
  await db.insert(simulatedActivityJobsTable).values(
    jobs.map((j) => ({
      executeAt: j.executeAt,
      action: j.action,
      payload: j.payload,
      status: "pending" as const,
    })),
  );
}

export type DailyPlanRecord = {
  date: string;
  posterIds: number[];
  postCount: number;
};

const DAILY_PLAN_KEY = "simulated_activity_daily_plan";

export async function getDailyPlan(): Promise<DailyPlanRecord | null> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, DAILY_PLAN_KEY))
    .limit(1);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as DailyPlanRecord;
  } catch {
    return null;
  }
}

export async function setDailyPlan(plan: DailyPlanRecord): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key: DAILY_PLAN_KEY, value: JSON.stringify(plan) })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: JSON.stringify(plan) },
    });
}

export async function claimDueSimulatedJobs(limit = 40): Promise<
  {
    id: number;
    executeAt: Date;
    action: SimulatedActivityAction;
    payload: SimulatedJobPayload;
  }[]
> {
  const now = new Date();
  const due = await db
    .select({
      id: simulatedActivityJobsTable.id,
      executeAt: simulatedActivityJobsTable.executeAt,
      action: simulatedActivityJobsTable.action,
      payload: simulatedActivityJobsTable.payload,
    })
    .from(simulatedActivityJobsTable)
    .where(
      and(
        eq(simulatedActivityJobsTable.status, "pending"),
        lte(simulatedActivityJobsTable.executeAt, now),
      ),
    )
    .orderBy(simulatedActivityJobsTable.executeAt)
    .limit(limit);

  return due.map((job) => ({
    ...job,
    payload: (job.payload ?? {}) as SimulatedJobPayload,
  }));
}

export async function markSimulatedJobDone(jobId: number): Promise<void> {
  await db
    .update(simulatedActivityJobsTable)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(simulatedActivityJobsTable.id, jobId));
}

export async function markSimulatedJobFailed(jobId: number): Promise<void> {
  await db
    .update(simulatedActivityJobsTable)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(simulatedActivityJobsTable.id, jobId));
}

export async function countPendingSimulatedJobs(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(simulatedActivityJobsTable)
    .where(eq(simulatedActivityJobsTable.status, "pending"));
  return Number(row?.count ?? 0);
}
