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

function viewerCategoryAffinityExpr(viewerId: number): SQL<boolean> {
  const preferred = sql`exists (
    select 1 from ${usersTable} u
    where u.id = ${viewerId}
      and (
        (
          ${postsTable.category} is not null
          and ${postsTable.category} = any(coalesce(u.preferred_categories, '{}'))
        )
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(${postsTable.categoryTags}, '[]')::jsonb) as tag
          where tag = any(coalesce(u.preferred_categories, '{}'))
        )
      )
  )`;

  const engagedCategory = sql`exists (
    select 1
    from ${postPrayersTable} pp
    inner join ${postsTable} engaged on engaged.id = pp.post_id
    where pp.user_id = ${viewerId}
      and engaged.category is not null
      and (
        engaged.category = ${postsTable.category}
        or coalesce(${postsTable.categoryTags}, '[]')::jsonb @> jsonb_build_array(engaged.category)
      )
  )`;

  const savedCategory = sql`exists (
    select 1
    from ${savedPostsTable} sp
    inner join ${postsTable} engaged on engaged.id = sp.post_id
    where sp.user_id = ${viewerId}
      and engaged.category is not null
      and (
        engaged.category = ${postsTable.category}
        or coalesce(${postsTable.categoryTags}, '[]')::jsonb @> jsonb_build_array(engaged.category)
      )
  )`;

  const commentedCategory = sql`exists (
    select 1
    from ${commentsTable} c
    inner join ${postsTable} engaged on engaged.id = c.post_id
    where c.author_id = ${viewerId}
      and engaged.category is not null
      and (
        engaged.category = ${postsTable.category}
        or coalesce(${postsTable.categoryTags}, '[]')::jsonb @> jsonb_build_array(engaged.category)
      )
  )`;

  return sql<boolean>`(${preferred} or ${engagedCategory} or ${savedCategory} or ${commentedCategory})`;
}

/**
 * Combined feed page priority (lower = higher in feed). Matches `computeFeedPagePriority`:
 * 0 = viewer's own posts
 * 1 = real authors the viewer follows or has prayed/saved/commented with
 * 2 = real posts in a similar niche (preferred or engaged categories)
 * 3 = other real community posts
 * 4 = seed/simulated and anonymous posts
 * Boost only affects sort timestamp within a tier, not the tier itself.
 * Logged-out viewers: real → seed/anonymous (boost is not a wall).
 */
export function feedPagePriorityExpr(
  viewerId: number | undefined,
  opts?: { personalize?: boolean },
): SQL<number> {
  const realAuthor = isRealUserAuthorExpr();

  if (viewerId == null) {
    return sql<number>`(
      case
        when ${realAuthor} then 0
        else 1
      end
    )`;
  }

  if (opts?.personalize === false) {
    return sql<number>`(
      case
        when ${postsTable.authorId} = ${viewerId} then 0
        when ${realAuthor} then 1
        else 2
      end
    )`;
  }

  const engagement = feedEngagementPriorityExpr(viewerId);
  const affinity = viewerCategoryAffinityExpr(viewerId);

  return sql<number>`(
    case
      when ${postsTable.authorId} = ${viewerId} then 0
      when ${realAuthor} and ${engagement} = 0 then 1
      when ${realAuthor} and ${affinity} then 2
      when ${realAuthor} then 3
      else 4
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
