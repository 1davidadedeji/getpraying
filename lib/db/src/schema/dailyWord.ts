import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Optional per-calendar-day override for the welcome screen “Today’s Word”. */
export const dailyWordOverridesTable = pgTable("daily_word_overrides", {
  id: serial("id").primaryKey(),
  effectiveDate: date("effective_date", { mode: "string" }).notNull().unique(),
  quoteText: text("quote_text").notNull(),
  reference: text("reference").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type DailyWordOverride = typeof dailyWordOverridesTable.$inferSelect;
