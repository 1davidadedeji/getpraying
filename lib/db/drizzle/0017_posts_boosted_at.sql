ALTER TABLE posts ADD COLUMN IF NOT EXISTS boosted_at timestamptz;
CREATE INDEX IF NOT EXISTS posts_boosted_at_idx ON posts (boosted_at DESC NULLS LAST) WHERE status = 'approved';
