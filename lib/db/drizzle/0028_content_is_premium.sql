ALTER TABLE official_prayers ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
