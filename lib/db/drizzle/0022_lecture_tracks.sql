CREATE TABLE IF NOT EXISTS "lecture_tracks" (
  "id" serial PRIMARY KEY NOT NULL,
  "lecture_id" integer NOT NULL REFERENCES "official_prayers"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "audio_url" text NOT NULL,
  "description" text,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lecture_tracks_lecture_id_idx" ON "lecture_tracks" ("lecture_id");

-- Migrate legacy single-file lectures into tracks (lectures = official_prayers.category 'lectures')
INSERT INTO "lecture_tracks" ("lecture_id", "title", "audio_url", "description", "order_index", "created_at", "updated_at")
SELECT
  op."id",
  op."title",
  op."audio_url",
  NULL,
  0,
  op."created_at",
  COALESCE(op."updated_at", op."created_at")
FROM "official_prayers" op
WHERE op."category" = 'lectures'
  AND op."audio_url" IS NOT NULL
  AND trim(op."audio_url") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "lecture_tracks" lt WHERE lt."lecture_id" = op."id"
  );

-- Lectures no longer use official_prayers.audio_url (sanctuary guides still do)
UPDATE "official_prayers"
SET "audio_url" = NULL
WHERE "category" = 'lectures'
  AND "audio_url" IS NOT NULL;
