ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "morning_notif_sent_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "evening_notif_sent_at" timestamp with time zone;
