-- Opt-in boost on create (pending posts apply boost on approval).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS boost_requested boolean NOT NULL DEFAULT false;

-- Trial subscribers may Boost once; set when their boost is applied.
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_boost_used_at timestamptz;
