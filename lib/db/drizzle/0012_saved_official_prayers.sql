CREATE TABLE IF NOT EXISTS saved_official_prayers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  official_prayer_id INTEGER NOT NULL REFERENCES official_prayers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, official_prayer_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_official_user ON saved_official_prayers(user_id);
