ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved_at timestamptz;
UPDATE posts SET approved_at = created_at WHERE status = 'approved' AND approved_at IS NULL;
CREATE INDEX IF NOT EXISTS posts_approved_at_idx ON posts (approved_at DESC NULLS LAST) WHERE status = 'approved';
