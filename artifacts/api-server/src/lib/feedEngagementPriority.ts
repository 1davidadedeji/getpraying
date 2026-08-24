import {
  commentsTable,
  postPrayersTable,
  postsTable,
  savedPostsTable,
  userFollowsTable,
  usersTable,
} from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { SEED_EMAIL_SUFFIX } from "./seedUsers";

const SEED_EMAIL_SQL_LIKE = `%${SEED_EMAIL_SUFFIX}`;

/** Post author is a real (non-seed) account. Anonymous posts return false. */
function isRealUserAuthorExpr(): SQL<boolean> {
  return sql`(
    ${postsTable.authorId} is not null
    and exists (
      select 1 from ${usersTable} u
      where u.id = ${postsTable.authorId}
        and u.email not like ${SEED_EMAIL_SQL_LIKE}
    )
  )`;
}

/** Post author is a seed / simulated community account. */
export function feedAuthorIsSeedExpr(): SQL<boolean> {
  return sql<boolean>`(
    ${postsTable.authorId} is not null
    and exists (
      select 1 from ${usersTable} u
      where u.id = ${postsTable.authorId}
        and u.email like ${SEED_EMAIL_SQL_LIKE}
    )
  )`;
}

/**
 * Feed tier: 0 = viewer has relationship with a real post author; 1 = no relationship.
 * Seed/simulated authors never qualify — bot engagement must not inflate relationship rank.
 */
export function feedEngagementPriorityExpr(viewerId: number): SQL<number> {
  const viewerPrayedAuthor = sql`exists (
    select 1 from ${postPrayersTable} pp
    inner join ${postsTable} author_post on author_post.id = pp.post_id
    where pp.user_id = ${viewerId}
      and author_post.author_id = ${postsTable.authorId}
      and author_post.author_id is not null
  )`;

  const viewerSavedAuthor = sql`exists (
    select 1 from ${savedPostsTable} sp
    inner join ${postsTable} author_post on author_post.id = sp.post_id
    where sp.user_id = ${viewerId}
      and author_post.author_id = ${postsTable.authorId}
      and author_post.author_id is not null
  )`;

  const viewerCommentedAuthor = sql`exists (
    select 1 from ${commentsTable} c
    inner join ${postsTable} author_post on author_post.id = c.post_id
    where c.author_id = ${viewerId}
      and author_post.author_id = ${postsTable.authorId}
      and author_post.author_id is not null
  )`;

  const authorPrayedViewer = sql`exists (
    select 1 from ${postPrayersTable} pp
    inner join ${postsTable} viewer_post on viewer_post.id = pp.post_id
    where pp.user_id = ${postsTable.authorId}
      and viewer_post.author_id = ${viewerId}
      and ${postsTable.authorId} is not null
  )`;

  const authorCommentedViewer = sql`exists (
    select 1 from ${commentsTable} c
    inner join ${postsTable} viewer_post on viewer_post.id = c.post_id
    where c.author_id = ${postsTable.authorId}
      and viewer_post.author_id = ${viewerId}
      and ${postsTable.authorId} is not null
  )`;

  const authorSavedViewer = sql`exists (
    select 1 from ${savedPostsTable} sp
    inner join ${postsTable} viewer_post on viewer_post.id = sp.post_id
    where sp.user_id = ${postsTable.authorId}
      and viewer_post.author_id = ${viewerId}
      and ${postsTable.authorId} is not null
  )`;

  const viewerFollowsAuthor = sql`exists (
    select 1 from ${userFollowsTable}
    where ${userFollowsTable.followerId} = ${viewerId}
      and ${userFollowsTable.followingId} = ${postsTable.authorId}
      and ${postsTable.authorId} is not null
  )`;

  const authorFollowsViewer = sql`exists (
    select 1 from ${userFollowsTable}
    where ${userFollowsTable.followerId} = ${postsTable.authorId}
      and ${userFollowsTable.followingId} = ${viewerId}
      and ${postsTable.authorId} is not null
  )`;

  const realAuthor = isRealUserAuthorExpr();

  return sql<number>`(
    case
      when ${postsTable.authorId} is null then 1
      when not (${realAuthor}) then 1
      when (
        ${viewerPrayedAuthor} or ${viewerSavedAuthor} or ${viewerCommentedAuthor}
        or ${authorPrayedViewer} or ${authorCommentedViewer} or ${authorSavedViewer}
        or ${viewerFollowsAuthor} or ${authorFollowsViewer}
      ) then 0
      else 1
    end
  )`;
}

/** Viewer already engaged with this specific post (pray/save/comment). */
function viewerEngagedOnPostExpr(viewerId: number) {
  const viewerPrayed = sql`exists (
    select 1 from ${postPrayersTable}
    where ${postPrayersTable.postId} = ${postsTable.id}
      and ${postPrayersTable.userId} = ${viewerId}
  )`;
  const viewerSaved = sql`exists (
    select 1 from ${savedPostsTable}
    where ${savedPostsTable.postId} = ${postsTable.id}
      and ${savedPostsTable.userId} = ${viewerId}
  )`;
  const viewerCommented = sql`exists (
    select 1 from ${commentsTable}
    where ${commentsTable.postId} = ${postsTable.id}
      and ${commentsTable.authorId} = ${viewerId}
  )`;
  return sql`(${viewerPrayed} or ${viewerSaved} or ${viewerCommented})`;
}

/**
 * Combined feed page priority (lower = higher in feed):
 * 0 = boosted and still surfaced (author viewing own post, or viewer has not engaged yet)
 * 1 = real authors the viewer follows or has prayed/saved/commented with
 * 2 = other real community posts
 * 3 = seed/simulated and anonymous posts
 * Within each tier: reverse-chronological by boosted/created timestamp, then id.
 * Logged-out viewers: boosted → real → seed/anonymous.
 */
export function feedPagePriorityExpr(viewerId: number | undefined): SQL<number> {
  const realAuthor = isRealUserAuthorExpr();

  if (viewerId == null) {
    return sql<number>`(
      case
        when ${postsTable.boostedAt} is not null then 0
        when ${realAuthor} then 1
        else 2
      end
    )`;
  }

  const engagedOnPost = viewerEngagedOnPostExpr(viewerId);
  const boostSurfaced = sql`(
    ${postsTable.boostedAt} is not null
    and (
      ${postsTable.authorId} = ${viewerId}
      or not (${engagedOnPost})
    )
  )`;
  const engagement = feedEngagementPriorityExpr(viewerId);

  return sql<number>`(
    case
      when ${boostSurfaced} then 0
      when ${realAuthor} and ${engagement} = 0 then 1
      when ${realAuthor} then 2
      else 3
    end
  )`;
}

/** Keyset pagination helper for priority + sort timestamp + id. */
export function feedCursorWhereClause(
  priorityExpr: SQL<number>,
  sortTs: SQL,
  cursor: { p: number; k: number; i: number },
): SQL {
  const kDate = new Date(cursor.k);
  return sql`(
    ${priorityExpr} > ${cursor.p}
    or (${priorityExpr} = ${cursor.p} and ${sortTs} < ${kDate})
    or (${priorityExpr} = ${cursor.p} and ${sortTs} = ${kDate} and ${postsTable.id} < ${cursor.i})
  )`;
}
