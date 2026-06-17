import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Case-insensitive username lookup (trimmed). */
export async function findUserByUsername(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = lower(${trimmed})`)
    .limit(1);

  return user ?? null;
}
