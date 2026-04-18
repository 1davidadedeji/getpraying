ALTER TABLE "official_prayers" ADD COLUMN IF NOT EXISTS "audio_url" text;
--> statement-breakpoint
ALTER TABLE "official_prayers" ADD COLUMN IF NOT EXISTS "uploaded_by_user_id" integer REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "official_prayers" ADD COLUMN IF NOT EXISTS "schedule_slot" text;
