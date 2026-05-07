import { pgEnum, pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  location: text("location"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  isBanned: boolean("is_banned").notNull().default(false),
  subscription: text("subscription").notNull().default("free"),
  platform: text("platform").notNull().default("unknown"),
  trialStartsAt: timestamp("trial_starts_at", { withTimezone: true }),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
  preferredCategories: text("preferred_categories").array().notNull().default([]),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  /** Expo push token for remote alerts (mobile app). */
  expoPushToken: text("expo_push_token"),
  /** IANA timezone string (e.g. "America/New_York") — used for scheduled push delivery. */
  timezone: text("timezone"),
  /** Last time the morning-prayer scheduled notification was sent (to prevent duplicates). */
  morningNotifSentAt: timestamp("morning_notif_sent_at", { withTimezone: true }),
  /** Last time the evening-prayer scheduled notification was sent (to prevent duplicates). */
  eveningNotifSentAt: timestamp("evening_notif_sent_at", { withTimezone: true }),
  /** User opt-out for the 4 AM / 5 PM scheduled push notifications (default true = opted in). */
  scheduledNotificationsEnabled: boolean("scheduled_notifications_enabled").notNull().default(true),
  prayersShared: integer("prayers_shared").notNull().default(0),
  prayedFor: integer("prayed_for").notNull().default(0),
  savedScrolls: integer("saved_scrolls").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  prayersShared: true,
  prayedFor: true,
  savedScrolls: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
