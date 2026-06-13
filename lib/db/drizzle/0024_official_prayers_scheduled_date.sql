ALTER TABLE "official_prayers" ADD COLUMN IF NOT EXISTS "scheduled_date" date;
--> statement-breakpoint
UPDATE "official_prayers"
SET "scheduled_date" = ("created_at" AT TIME ZONE 'UTC')::date
WHERE "schedule_slot" IN ('morning', 'evening') AND "scheduled_date" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "official_prayers_slot_scheduled_date_uidx"
  ON "official_prayers" ("schedule_slot", "scheduled_date")
  WHERE "schedule_slot" IS NOT NULL AND "scheduled_date" IS NOT NULL;
