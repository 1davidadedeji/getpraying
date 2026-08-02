import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type SimulatedActivityAction = "post" | "pray" | "comment" | "save" | "boost";

export type SimulatedActivityStatus = "pending" | "done" | "failed";

export const simulatedActivityJobsTable = pgTable("simulated_activity_jobs", {
  id: serial("id").primaryKey(),
  executeAt: timestamp("execute_at", { withTimezone: true }).notNull(),
  action: text("action").notNull().$type<SimulatedActivityAction>(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending").$type<SimulatedActivityStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
