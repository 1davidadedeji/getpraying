-- One lifetime free boost per account (renamed from trial-only column).
ALTER TABLE users RENAME COLUMN trial_boost_used_at TO free_boost_used_at;

-- Recurring subscription prompt schedule (Phase 3).
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_prompt_last_shown_at timestamptz;
