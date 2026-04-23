-- Run against your app database (e.g. after backup). Safe to run once.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS category_tags text;

ALTER TABLE official_prayers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE official_prayers
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_post_deletions (
  id serial PRIMARY KEY,
  post_id integer NOT NULL,
  author_id integer NOT NULL,
  staff_user_id integer NOT NULL REFERENCES users (id),
  reason text NOT NULL,
  content_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_post_deletions_created_at_idx ON staff_post_deletions (created_at);
CREATE INDEX IF NOT EXISTS staff_post_deletions_author_idx ON staff_post_deletions (author_id);
