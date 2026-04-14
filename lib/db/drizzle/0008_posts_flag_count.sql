-- Add flag_count column to posts for threshold-based community flagging
ALTER TABLE posts ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0;
