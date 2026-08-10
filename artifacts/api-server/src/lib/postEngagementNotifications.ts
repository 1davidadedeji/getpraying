import {
  commentsTable,
  notificationsTable,
  postPrayersTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { pushForNotificationById } from "./pushForNotification";
import { PRAYER_MILESTONES, shouldNotifyPostAuthor } from "./postEngagementNotifyPolicy";

export { PRAYER_MILESTONES, shouldNotifyPostAuthor } from "./postEngagementNotifyPolicy";

type DbClient = {
  insert: typeof import("@workspace/db").db.insert;
  select: typeof import("@workspace/db").db.select;
  update: typeof import("@workspace/db").db.update;
};

export async function insertPrayEngagementNotifications(
  client: DbClient,
  params: {
    authorId: number;
    actorId: number;
    postId: number;
    newPrayCount: number;
  },
): Promise<number[]> {
  const ids: number[] = [];

  const [nPray] = await client
    .insert(notificationsTable)
    .values({
      userId: params.authorId,
      type: "prayer",
      message: "Someone prayed for you",
      actorId: params.actorId,
      postId: params.postId,
      isRead: false,
    })
    .returning({ id: notificationsTable.id });
  if (nPray?.id) ids.push(nPray.id);

  if (PRAYER_MILESTONES.includes(params.newPrayCount as (typeof PRAYER_MILESTONES)[number])) {
    const [nMil] = await client
      .insert(notificationsTable)
      .values({
        userId: params.authorId,
        type: "prayer_milestone",
        message: `${params.newPrayCount} people are now praying for your post! 🙌`,
        actorId: null,
        postId: params.postId,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });
    if (nMil?.id) ids.push(nMil.id);
  }

  return ids;
}

export async function insertCommentEngagementNotification(
  client: DbClient,
  params: { authorId: number; actorId: number; postId: number },
): Promise<number | null> {
  const [notif] = await client
    .insert(notificationsTable)
    .values({
      userId: params.authorId,
      type: "comment",
      message: "commented on your prayer",
      actorId: params.actorId,
      postId: params.postId,
      isRead: false,
    })
    .returning({ id: notificationsTable.id });
  return notif?.id ?? null;
}

export async function insertSaveEngagementNotification(
  client: DbClient,
  params: { authorId: number; actorId: number; postId: number },
): Promise<number | null> {
  const [notif] = await client
    .insert(notificationsTable)
    .values({
      userId: params.authorId,
      type: "saved",
      message: "saved your prayer to their library.",
      actorId: params.actorId,
      postId: params.postId,
      isRead: false,
    })
    .returning({ id: notificationsTable.id });
  return notif?.id ?? null;
}

export async function maybeBumpPrayedForOnComment(
  client: DbClient,
  params: { authorId: number; actorId: number; postId: number },
): Promise<void> {
  const priorPray = await client
    .select({ id: postPrayersTable.id })
    .from(postPrayersTable)
    .where(and(eq(postPrayersTable.postId, params.postId), eq(postPrayersTable.userId, params.actorId)))
    .limit(1);
  if (priorPray.length > 0) return;

  await client
    .update(usersTable)
    .set({ prayedFor: sql`${usersTable.prayedFor} + 1` })
    .where(eq(usersTable.id, params.authorId));
}

export function dispatchPushForNotificationIds(ids: number[]): void {
  for (const id of ids) {
    if (id > 0) void pushForNotificationById(id);
  }
}

export async function notifyPostOwnerOfPrayEngagement(
  client: DbClient,
  post: { id: number; authorId: number | null },
  actorId: number,
  newPrayCount: number,
): Promise<void> {
  if (!(await shouldNotifyPostAuthor(post.authorId, actorId))) return;
  const ids = await insertPrayEngagementNotifications(client, {
    authorId: post.authorId!,
    actorId,
    postId: post.id,
    newPrayCount,
  });
  dispatchPushForNotificationIds(ids);
}

export async function notifyPostOwnerOfCommentEngagement(
  client: DbClient,
  post: { id: number; authorId: number | null },
  actorId: number,
): Promise<void> {
  if (!(await shouldNotifyPostAuthor(post.authorId, actorId))) return;
  await maybeBumpPrayedForOnComment(client, {
    authorId: post.authorId!,
    actorId,
    postId: post.id,
  });
  const id = await insertCommentEngagementNotification(client, {
    authorId: post.authorId!,
    actorId,
    postId: post.id,
  });
  if (id) dispatchPushForNotificationIds([id]);
}

export async function notifyPostOwnerOfSaveEngagement(
  client: DbClient,
  post: { id: number; authorId: number | null },
  actorId: number,
): Promise<void> {
  if (!(await shouldNotifyPostAuthor(post.authorId, actorId))) return;
  const id = await insertSaveEngagementNotification(client, {
    authorId: post.authorId!,
    actorId,
    postId: post.id,
  });
  if (id) dispatchPushForNotificationIds([id]);
}
