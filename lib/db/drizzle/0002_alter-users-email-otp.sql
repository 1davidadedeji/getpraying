-- Custom SQL migration file, put your code below! --

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "verification_token" text,
  ADD COLUMN IF NOT EXISTS "verification_expires_at" timestamp with time zone;