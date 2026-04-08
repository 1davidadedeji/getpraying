-- Backfill display_name to username when blank

UPDATE "users"
SET "display_name" = "username"
WHERE "display_name" IS NULL OR btrim("display_name") = '';

