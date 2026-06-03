import { db, postsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { userIsPayingSubscriber } from "./auth";
import { broadcastPushToRegisteredDevices } from "./broadcastPush";

type PostRow = typeof postsTable.$inferSelect;

/** Paying subscribers (not trial) get posts auto-boosted when approved. */
export async function applyAutoBoostIfEligible(post: PostRow): Promise<PostRow> {
  if (post.status !== "approved" || post.boostedAt != null || post.authorId == null) {
    return post;
  }

  const [author] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, post.authorId))
    .limit(1);

  if (!author || !userIsPayingSubscriber(author)) {
    return post;
  }

  const now = new Date();
  const [boosted] = await db
    .update(postsTable)
    .set({ boostedAt: now, boostedByUserId: author.id, updatedAt: now })
    .where(and(eq(postsTable.id, post.id), sql`${postsTable.boostedAt} is null`))
    .returning();

  if (!boosted) return post;

  let authorUsername: string | null = author.username ?? null;
  if (!boosted.isAnonymous && boosted.authorId != null && !authorUsername) {
    const [a] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, boosted.authorId))
      .limit(1);
    authorUsername = a?.username ?? null;
  }

  const nameForPush = boosted.isAnonymous ? "Someone" : (authorUsername ?? "A member");
  void broadcastPushToRegisteredDevices({
    title: "Get Praying",
    body: `Someone needs help. See who.`,
    data: {
      type: "boost_alert",
      postId: String(boosted.id),
      boostedByUserId: String(author.id),
    },
    excludeUserIds: new Set<number>([author.id]),
  });

  return boosted;
}
