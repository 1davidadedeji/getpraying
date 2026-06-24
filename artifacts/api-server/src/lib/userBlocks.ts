import { db, blockedUsersTable, userFollowsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";

/** User ids whose posts should be hidden from the viewer's feed (bidirectional). */
export async function getFeedExcludedAuthorIds(viewerId: number): Promise<number[]> {
  const blockedByViewer = await db
    .select({ id: blockedUsersTable.blockedId })
    .from(blockedUsersTable)
    .where(eq(blockedUsersTable.blockerId, viewerId));
  const whoBlockedViewer = await db
    .select({ id: blockedUsersTable.blockerId })
    .from(blockedUsersTable)
    .where(eq(blockedUsersTable.blockedId, viewerId));

  const ids = new Set<number>();
  for (const row of blockedByViewer) ids.add(row.id);
  for (const row of whoBlockedViewer) ids.add(row.id);
  return [...ids];
}

export async function isBlockedBetween(userA: number, userB: number): Promise<boolean> {
  const [row] = await db
    .select({ id: blockedUsersTable.id })
    .from(blockedUsersTable)
    .where(
      or(
        and(eq(blockedUsersTable.blockerId, userA), eq(blockedUsersTable.blockedId, userB)),
        and(eq(blockedUsersTable.blockerId, userB), eq(blockedUsersTable.blockedId, userA)),
      )!,
    )
    .limit(1);
  return !!row;
}

export async function viewerBlockedTarget(viewerId: number, targetId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: blockedUsersTable.id })
    .from(blockedUsersTable)
    .where(and(eq(blockedUsersTable.blockerId, viewerId), eq(blockedUsersTable.blockedId, targetId)))
    .limit(1);
  return !!row;
}

/** Create block row and remove follow edges between the two users. */
export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  await db
    .insert(blockedUsersTable)
    .values({ blockerId, blockedId })
    .onConflictDoNothing({
      target: [blockedUsersTable.blockerId, blockedUsersTable.blockedId],
    });

  await db
    .delete(userFollowsTable)
    .where(
      or(
        and(eq(userFollowsTable.followerId, blockerId), eq(userFollowsTable.followingId, blockedId)),
        and(eq(userFollowsTable.followerId, blockedId), eq(userFollowsTable.followingId, blockerId)),
      )!,
    );
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
  await db
    .delete(blockedUsersTable)
    .where(and(eq(blockedUsersTable.blockerId, blockerId), eq(blockedUsersTable.blockedId, blockedId)));
}
