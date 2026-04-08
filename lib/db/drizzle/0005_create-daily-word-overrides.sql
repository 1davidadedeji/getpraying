-- Per-day optional override for welcome screen daily word

CREATE TABLE IF NOT EXISTS "daily_word_overrides" (
  "id" serial PRIMARY KEY,
  "effective_date" date NOT NULL UNIQUE,
  "quote_text" text NOT NULL,
  "reference" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
