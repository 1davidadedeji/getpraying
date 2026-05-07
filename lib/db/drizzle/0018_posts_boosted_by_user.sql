ALTER TABLE posts ADD COLUMN IF NOT EXISTS boosted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;
