import {
  commentsTable,
  db,
  postPrayersTable,
  postsTable,
  savedPostsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { isSeedUserId } from "./seedUsers";
import { generateSimulatedComment, generateSimulatedPrayerPost } from "./simulatedPrayerContent";
import { scheduleEngagementForPost } from "./simulatedActivityPlanner";
import type { SimulatedJobPayload } from "./simulatedActivityJobs";
import { markSimulatedJobDone, markSimulatedJobFailed } from "./simulatedActivityJobs";
import {
  notifyPostOwnerOfCommentEngagement,
  notifyPostOwnerOfPrayEngagement,
  notifyPostOwnerOfSaveEngagement,
} from "./postEngagementNotifications";

async function executePost(payload: SimulatedJobPayload): Promise<boolean> {
  const authorId = payload.authorId;
  if (!authorId || !(await isSeedUserId(authorId))) {
    return false;
  }

  const generated = await generateSimulatedPrayerPost();
  const category = payload.category ?? generated.category;
  const categoryTags = category ? JSON.stringify([category]) : null;

  const [post] = await db
    .insert(postsTable)
    .values({
      content: generated.content,
      category,
      categoryTags,
      status: "approved",
      authorId,
      isAnonymous: false,
      approvedAt: new Date(),
    })
    .returning();

  await db
    .update(usersTable)
    .set({ prayersShared: sql`${usersTable.prayersShared} + 1` })
    .where(eq(usersTable.id, authorId));

  await scheduleEngagementForPost(post.id, authorId, false);
  return true;
}

async function executePray(postId: number, userId: number): Promise<void> {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post || post.status !== "approved") return;
  if (post.authorId === userId) return;

  const inserted = await db
    .insert(postPrayersTable)
    .values({ postId, userId })
    .onConflictDoNothing({ target: [postPrayersTable.postId, postPrayersTable.userId] })
    .returning({ id: postPrayersTable.id });
  if (inserted.length === 0) return;

  const [updated] = await db
    .update(postsTable)
    .set({ prayCount: sql`${postsTable.prayCount} + 1` })
    .where(eq(postsTable.id, postId))
    .returning({ prayCount: postsTable.prayCount });

  const newCount = Number(updated?.prayCount ?? 0);
  await notifyPostOwnerOfPrayEngagement(db, post, userId, newCount);
}

async function executeSave(postId: number, userId: number): Promise<void> {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post || post.status !== "approved") return;
  if (post.authorId === userId) return;

  const inserted = await db
    .insert(savedPostsTable)
    .values({ postId, userId })
    .onConflictDoNothing({ target: [savedPostsTable.postId, savedPostsTable.userId] })
    .returning({ id: savedPostsTable.id });
  if (inserted.length === 0) return;

  await db
    .update(usersTable)
    .set({ savedScrolls: sql`${usersTable.savedScrolls} + 1` })
    .where(eq(usersTable.id, userId));

  await notifyPostOwnerOfSaveEngagement(db, post, userId);
}

async function executeComment(
  postId: number,
  userId: number,
  realUserPost: boolean,
  presetContent?: string,
): Promise<void> {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post || post.status !== "approved") return;
  if (post.authorId === userId) return;

  const existing = await db
    .select({ id: commentsTable.id })
    .from(commentsTable)
    .where(and(eq(commentsTable.postId, postId), eq(commentsTable.authorId, userId)))
    .limit(1);
  if (existing.length > 0) return;

  const content =
    presetContent ??
    (await generateSimulatedComment(post.content, { realUserPost }));

  const [created] = await db
    .insert(commentsTable)
    .values({ postId, authorId: userId, content })
    .returning();

  if (!created) return;

  await notifyPostOwnerOfCommentEngagement(db, post, userId);
}

async function executeBoost(postId: number): Promise<void> {
  await db
    .update(postsTable)
    .set({ boostedAt: new Date() })
    .where(and(eq(postsTable.id, postId), sql`${postsTable.boostedAt} is null`));
}

export async function executeSimulatedActivityJob(job: {
  id: number;
  action: string;
  payload: SimulatedJobPayload;
}): Promise<void> {
  try {
    let ok = true;
    switch (job.action) {
      case "post":
        ok = await executePost(job.payload);
        break;
      case "pray":
        if (job.payload.postId && job.payload.userId) {
          await executePray(job.payload.postId, job.payload.userId);
        }
        break;
      case "save":
        if (job.payload.postId && job.payload.userId) {
          await executeSave(job.payload.postId, job.payload.userId);
        }
        break;
      case "comment":
        if (job.payload.postId && job.payload.userId) {
          await executeComment(
            job.payload.postId,
            job.payload.userId,
            job.payload.realUserPost === true,
            job.payload.content,
          );
        }
        break;
      case "boost":
        if (job.payload.postId) {
          await executeBoost(job.payload.postId);
        }
        break;
      default:
        ok = false;
    }
    if (ok) {
      await markSimulatedJobDone(job.id);
    } else {
      await markSimulatedJobFailed(job.id);
    }
  } catch (err) {
    console.warn(`[simulated-activity] job ${job.id} (${job.action}) failed:`, err);
    await markSimulatedJobFailed(job.id);
  }
}
