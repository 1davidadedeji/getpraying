import { commentsTable, postPrayersTable, postsTable, savedPostsTable } from "@workspace/db";
import { and, eq, sql, type SQL } from "drizzle-orm";

/**
 * Feed tier: 0 = viewer has mutual / one-way engagement with post author; 1 = everyone else.
 * Anonymous posts (null author) always tier 1.
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

  return sql<number>`(
    case
      when ${postsTable.authorId} is null then 1
      when (
        ${viewerPrayedAuthor} or ${viewerSavedAuthor} or ${viewerCommentedAuthor}
        or ${authorPrayedViewer} or ${authorCommentedViewer} or ${authorSavedViewer}
      ) then 0
      else 1
    end
  )`;
}

/**
 * Combined feed page priority (lower = higher in feed):
 * For authenticated viewers (matches product spec):
 *   0 = authors the viewer has a relationship with (pray/save/comment either way)
 *   1 = everyone else
 * Boosted posts still rise within a tier via COALESCE(boosted_at, created_at) sort.
 * Logged-out viewers: boosted posts first, then everything else.
 */
export function feedPagePriorityExpr(viewerId: number | undefined): SQL<number> {
  if (viewerId == null) {
    return sql<number>`(case when ${postsTable.boostedAt} is not null then 0 else 1 end)`;
  }

  const engagement = feedEngagementPriorityExpr(viewerId);

  return sql<number>`(
    case
      when ${engagement} = 0 then 0
      else 1
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
