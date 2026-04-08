-- Create comments table

CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY,
  "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "author_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comments_post_id_idx" ON "comments" ("post_id");
CREATE INDEX IF NOT EXISTS "comments_author_id_idx" ON "comments" ("author_id");
