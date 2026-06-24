import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/** Viewer blocks blocked user — hides their content from feeds and prevents interaction. */
export const blockedUsersTable = pgTable(
  "blocked_users",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocked_users_blocker_blocked_uidx").on(t.blockerId, t.blockedId)],
);

export const insertBlockedUserSchema = createInsertSchema(blockedUsersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBlockedUser = z.infer<typeof insertBlockedUserSchema>;
export type BlockedUser = typeof blockedUsersTable.$inferSelect;
