import { db, postReportsTable, usersTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

export type PostReportForStaff = {
  reporterUsername: string;
  reporterDisplayName: string | null;
  reason: string;
  createdAt: string;
};

export async function insertPostReport(opts: {
  postId: number;
  reporterId: number;
  reason: string;
}): Promise<{ inserted: boolean; duplicate: boolean }> {
  try {
    await db.insert(postReportsTable).values({
      postId: opts.postId,
      reporterId: opts.reporterId,
      reason: opts.reason,
    });
    return { inserted: true, duplicate: false };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "23505") return { inserted: false, duplicate: true };
    throw e;
  }
}

export async function clearPostReportsForPost(postId: number): Promise<void> {
  await db.delete(postReportsTable).where(eq(postReportsTable.postId, postId));
}

export async function loadPostReportsByPostIds(
  postIds: number[],
): Promise<Map<number, PostReportForStaff[]>> {
  const map = new Map<number, PostReportForStaff[]>();
  if (postIds.length === 0) return map;

  const rows = await db
    .select({
      postId: postReportsTable.postId,
      reason: postReportsTable.reason,
      createdAt: postReportsTable.createdAt,
      reporterUsername: usersTable.username,
      reporterDisplayName: usersTable.displayName,
    })
    .from(postReportsTable)
    .innerJoin(usersTable, eq(postReportsTable.reporterId, usersTable.id))
    .where(inArray(postReportsTable.postId, postIds))
    .orderBy(desc(postReportsTable.createdAt));

  for (const row of rows) {
    const list = map.get(row.postId) ?? [];
    list.push({
      reporterUsername: row.reporterUsername,
      reporterDisplayName: row.reporterDisplayName,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    });
    map.set(row.postId, list);
  }
  return map;
}

export async function attachReportsForStaff<T extends { id: number }>(
  posts: T[],
): Promise<Array<T & { reports: PostReportForStaff[] }>> {
  const reportsMap = await loadPostReportsByPostIds(posts.map((p) => p.id));
  return posts.map((p) => ({
    ...p,
    reports: reportsMap.get(p.id) ?? [],
  }));
}

export async function userAlreadyReportedPost(postId: number, reporterId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: postReportsTable.id })
    .from(postReportsTable)
    .where(and(eq(postReportsTable.postId, postId), eq(postReportsTable.reporterId, reporterId)))
    .limit(1);
  return !!row;
}
