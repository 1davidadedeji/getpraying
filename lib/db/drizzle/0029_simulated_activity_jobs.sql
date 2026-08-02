CREATE TABLE IF NOT EXISTS simulated_activity_jobs (
  id serial PRIMARY KEY,
  execute_at timestamptz NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS simulated_activity_jobs_pending_execute_idx
  ON simulated_activity_jobs (execute_at)
  WHERE status = 'pending';
