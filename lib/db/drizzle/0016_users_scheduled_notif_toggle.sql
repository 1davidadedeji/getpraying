ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "scheduled_notifications_enabled" boolean NOT NULL DEFAULT true;
