import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Audit when staff delete another user's post (reason required for non-author deletion). */
export const staffPostDeletionsTable = pgTable("staff_post_deletions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  staffUserId: integer("staff_user_id")
    .notNull()
    .references(() => usersTable.id),
  reason: text("reason").notNull(),
  contentPreview: text("content_preview"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
