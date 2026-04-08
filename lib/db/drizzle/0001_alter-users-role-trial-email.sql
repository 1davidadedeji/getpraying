-- Add role enum + trial/email columns; replace is_admin

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE "user_role" AS ENUM ('user', 'moderator', 'admin');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "trial_starts_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "is_email_verified" boolean NOT NULL DEFAULT false;

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "is_admin";