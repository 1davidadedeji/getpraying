import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postReportsTable = pgTable(
  "post_reports",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postReporterUidx: uniqueIndex("post_reports_post_reporter_uidx").on(t.postId, t.reporterId),
  }),
);

export type PostReport = typeof postReportsTable.$inferSelect;
