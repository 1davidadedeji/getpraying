ALTER TABLE "users" ADD COLUMN "password_reset_token" text;
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" timestamp with time zone;
ALTER TABLE "posts" ADD COLUMN "moderated_by_user_id" integer;
ALTER TABLE "posts" ADD CONSTRAINT "posts_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
