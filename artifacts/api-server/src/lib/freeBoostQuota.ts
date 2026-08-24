import { db, postsTable } from "@workspace/db";
import { and, eq, isNotNull, ne, or } from "drizzle-orm";

/** Free-tier user already boosted or has another pending boost request in flight. */
export async function freeUserHasBoostPendingOrUsed(
  userId: number,
  excludePostId?: number,
): Promise<boolean> {
  const conditions = [
    eq(postsTable.authorId, userId),
    ne(postsTable.status, "declined"),
    or(
      and(eq(postsTable.boostRequested, true), eq(postsTable.status, "pending")),
      and(isNotNull(postsTable.boostedAt), eq(postsTable.status, "approved")),
    ),
  ];
  if (excludePostId != null) {
    conditions.push(ne(postsTable.id, excludePostId));
  }
  const [row] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(...conditions))
    .limit(1);
  return Boolean(row);
}
