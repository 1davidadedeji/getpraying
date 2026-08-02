import { db, usersTable } from "@workspace/db";
import { like } from "drizzle-orm";

export const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";

export function isSeedUserEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith(SEED_EMAIL_SUFFIX);
}

export type SeedUserRow = { id: number; username: string; email: string };

let seedUsersCache: { at: number; users: SeedUserRow[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function loadSeedUsers(force = false): Promise<SeedUserRow[]> {
  const now = Date.now();
  if (!force && seedUsersCache && now - seedUsersCache.at < CACHE_TTL_MS) {
    return seedUsersCache.users;
  }
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email })
    .from(usersTable)
    .where(like(usersTable.email, `%${SEED_EMAIL_SUFFIX}`));
  seedUsersCache = { at: now, users };
  return users;
}

export async function isSeedUserId(userId: number): Promise<boolean> {
  const users = await loadSeedUsers();
  return users.some((u) => u.id === userId);
}
