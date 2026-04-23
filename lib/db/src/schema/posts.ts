import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"), // 'image' | 'video'
  category: text("category"),
  /** JSON array string of category slugs (primary = `category`, usually first tag) */
  categoryTags: text("category_tags"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'declined'
  flagReason: text("flag_reason"),
  flagCount: integer("flag_count").notNull().default(0),
  /** Shown to the author when a moderator declines the post (also copied into notifications). */
  moderationReason: text("moderation_reason"),
  prayCount: integer("pray_count").notNull().default(0),
  authorId: integer("author_id").references(() => usersTable.id),
  moderatedByUserId: integer("moderated_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  prayCount: true,
  status: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
