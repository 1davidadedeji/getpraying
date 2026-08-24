import { db, postsTable, usersTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  isFreeSubscription,
  subscriptionTierGrantsUnlimitedBoost,
  userCanApplyBoost,
} from "./boostEligibility";
import { freeUserHasBoostPendingOrUsed } from "./freeBoostQuota";
import { broadcastPushToRegisteredDevices } from "./broadcastPush";

type PostRow = typeof postsTable.$inferSelect;
type UserRow = typeof usersTable.$inferSelect;

/** Apply Boost to an approved post (feed priority + community push). Opt-in only. */
export async function applyBoostToPost(
  post: PostRow,
  _author?: UserRow | null,
): Promise<PostRow> {
  if (post.status !== "approved" || post.boostedAt != null || post.authorId == null) {
    return post;
  }

  const authorId = post.authorId;
  const now = new Date();

  const boosted = await db.transaction(async (tx) => {
    const [authorRow] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, authorId))
      .for("update")
      .limit(1);

    if (!authorRow) return null;

    const freeHasPendingOrUsed = isFreeSubscription(authorRow.subscription)
      ? await freeUserHasBoostPendingOrUsed(authorRow.id, post.id)
      : false;

    if (
      !(await userCanApplyBoost(authorRow, {
        freeHasPendingOrUsed,
      }))
    ) {
      return null;
    }

    const [row] = await tx
      .update(postsTable)
      .set({
        boostedAt: now,
        boostedByUserId: authorRow.id,
        boostRequested: false,
        updatedAt: now,
      })
      .where(and(eq(postsTable.id, post.id), sql`${postsTable.boostedAt} is null`))
      .returning();

    if (!row) return null;

    if (
      isFreeSubscription(authorRow.subscription) &&
      !subscriptionTierGrantsUnlimitedBoost(authorRow.subscription)
    ) {
      await tx
        .update(usersTable)
        .set({ freeBoostUsedAt: now, updatedAt: now })
        .where(and(eq(usersTable.id, authorRow.id), isNull(usersTable.freeBoostUsedAt)));
    }

    return { row, authorRow };
  });

  if (!boosted) return post;

  const { row: boostedPost, authorRow } = boosted;

  let authorUsername: string | null = authorRow.username ?? null;
  if (!boostedPost.isAnonymous && boostedPost.authorId != null && !authorUsername) {
    const [a] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, boostedPost.authorId))
      .limit(1);
    authorUsername = a?.username ?? null;
  }

  void broadcastPushToRegisteredDevices({
    title: "Get Praying",
    body: `Someone needs help. See who.`,
    data: {
      type: "boost_alert",
      postId: String(boostedPost.id),
      boostedByUserId: String(authorRow.id),
    },
    excludeUserIds: new Set<number>([authorRow.id]),
  });

  return boostedPost;
}

/** @deprecated Use applyBoostToPost — Boost is never automatic on plain posts. */
export async function applyAutoBoostIfEligible(post: PostRow): Promise<PostRow> {
  if (!post.boostRequested) return post;
  return applyBoostToPost(post);
}
