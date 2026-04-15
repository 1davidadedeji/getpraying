import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { postsTable } from "./posts";

// Stores prayer reactions (like "likes" but prayers)
export const postPrayersTable = pgTable(
  "post_prayers",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => postsTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("post_prayers_post_id_user_id_uidx").on(t.postId, t.userId)],
);

// Saves/bookmarks
export const savedPostsTable = pgTable(
  "saved_posts",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => postsTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_posts_post_id_user_id_uidx").on(t.postId, t.userId)],
);

// Official curated prayers
export const officialPrayersTable = pgTable("official_prayers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  content: text("content").notNull(),
  category: text("category").notNull(),
  durationMinutes: integer("duration_minutes"),
  scripture: text("scripture"),
  label: text("label"),
  audioVoice: text("audio_voice"),
  pathId: integer("path_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Prayer paths / journeys
export const prayerPathsTable = pgTable("prayer_paths", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  tagline: text("tagline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Notifications
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(), // 'prayer' | 'system' | 'category_new' | 'reminder'
  message: text("message").notNull(),
  actorId: integer("actor_id").references(() => usersTable.id),
  postId: integer("post_id").references(() => postsTable.id),
  category: text("category"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sessions
export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostPrayerSchema = createInsertSchema(postPrayersTable).omit({ id: true, createdAt: true });
export type InsertPostPrayer = z.infer<typeof insertPostPrayerSchema>;
export type PostPrayer = typeof postPrayersTable.$inferSelect;

export const insertSavedPostSchema = createInsertSchema(savedPostsTable).omit({ id: true, createdAt: true });
export type InsertSavedPost = z.infer<typeof insertSavedPostSchema>;
export type SavedPost = typeof savedPostsTable.$inferSelect;

export const insertOfficialPrayerSchema = createInsertSchema(officialPrayersTable).omit({ id: true, createdAt: true });
export type InsertOfficialPrayer = z.infer<typeof insertOfficialPrayerSchema>;
export type OfficialPrayer = typeof officialPrayersTable.$inferSelect;

export const insertPrayerPathSchema = createInsertSchema(prayerPathsTable).omit({ id: true, createdAt: true });
export type InsertPrayerPath = z.infer<typeof insertPrayerPathSchema>;
export type PrayerPath = typeof prayerPathsTable.$inferSelect;
