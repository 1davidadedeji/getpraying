CREATE TABLE IF NOT EXISTS "blocked_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "blocker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "blocked_users_blocker_blocked_uidx" ON "blocked_users" ("blocker_id", "blocked_id");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz;
