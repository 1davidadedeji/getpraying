-- Per-user post reports (reporter identity visible to staff only).
CREATE TABLE IF NOT EXISTS post_reports (
  id serial PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS post_reports_post_reporter_uidx ON post_reports (post_id, reporter_id);
CREATE INDEX IF NOT EXISTS post_reports_post_id_idx ON post_reports (post_id);
