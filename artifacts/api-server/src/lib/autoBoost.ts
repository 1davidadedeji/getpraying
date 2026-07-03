import { db, postsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  isTrialSubscription,
  userCanApplyBoost,
} from "./boostEligibility";
import { trialUserHasBoostPendingOrUsed } from "./trialBoostQuota";
import { broadcastPushToRegisteredDevices } from "./broadcastPush";

type PostRow = typeof postsTable.$inferSelect;
type UserRow = typeof usersTable.$inferSelect;

/** Apply Boost to an approved post (feed priority + community push). Opt-in only. */
export async function applyBoostToPost(
  post: PostRow,
  author?: UserRow | null,
): Promise<PostRow> {
  if (post.status !== "approved" || post.boostedAt != null || post.authorId == null) {
    return post;
  }

  const authorRow =
    author ??
    (
      await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, post.authorId))
        .limit(1)
    )[0];

  if (!authorRow || !(await userCanApplyBoost(authorRow, {
    trialHasPendingOrUsed: isTrialSubscription(authorRow.subscription)
      ? await trialUserHasBoostPendingOrUsed(authorRow.id, post.id)
      : false,
  }))) {
    return post;
  }

  const now = new Date();
  const [boosted] = await db
    .update(postsTable)
    .set({
      boostedAt: now,
      boostedByUserId: authorRow.id,
      boostRequested: false,
      updatedAt: now,
    })
    .where(and(eq(postsTable.id, post.id), sql`${postsTable.boostedAt} is null`))
    .returning();

  if (!boosted) return post;

  if (isTrialSubscription(authorRow.subscription) && authorRow.trialBoostUsedAt == null) {
    await db
      .update(usersTable)
      .set({ trialBoostUsedAt: now, updatedAt: now })
      .where(eq(usersTable.id, authorRow.id));
  }

  let authorUsername: string | null = authorRow.username ?? null;
  if (!boosted.isAnonymous && boosted.authorId != null && !authorUsername) {
    const [a] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, boosted.authorId))
      .limit(1);
    authorUsername = a?.username ?? null;
  }

  void broadcastPushToRegisteredDevices({
    title: "Boosted prayer",
    body: "Tap to see who needs your support.",
    data: {
      type: "boost_alert",
      postId: String(boosted.id),
      boostedByUserId: String(authorRow.id),
    },
    excludeUserIds: new Set<number>([authorRow.id]),
  });

  return boosted;
}

/** @deprecated Use applyBoostToPost — Boost is never automatic on plain posts. */
export async function applyAutoBoostIfEligible(post: PostRow): Promise<PostRow> {
  if (!post.boostRequested) return post;
  return applyBoostToPost(post);
}
