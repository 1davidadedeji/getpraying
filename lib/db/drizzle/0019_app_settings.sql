CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "app_settings" ("key", "value")
VALUES ('daily_word_auto_rotation', 'false')
ON CONFLICT ("key") DO NOTHING;
