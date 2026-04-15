-- Remove duplicate (post_id, user_id) pairs before adding unique constraints
DELETE FROM post_prayers a
USING post_prayers b
WHERE a.id > b.id AND a.post_id = b.post_id AND a.user_id = b.user_id;

DELETE FROM saved_posts a
USING saved_posts b
WHERE a.id > b.id AND a.post_id = b.post_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS "post_prayers_post_id_user_id_uidx" ON "post_prayers" ("post_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_posts_post_id_user_id_uidx" ON "saved_posts" ("post_id", "user_id");
