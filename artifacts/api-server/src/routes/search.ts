import { Router, type IRouter } from "express";
import { db, usersTable, postsTable } from "@workspace/db";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { optionalAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

const router: IRouter = Router();

function normalizeSearch(q: unknown): string {
  if (typeof q !== "string") return "";
  return q.normalize("NFKC").trim().slice(0, 140);
}

function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** GET /search?q=term — shallow ILIKE lookups (indexed paths can be added later). */
router.get("/search", optionalAuth, async (req, res): Promise<void> => {
  const raw = normalizeSearch(req.query.q);
  if (!raw || raw.length < 2) {
    res.json({ users: [], posts: [] });
    return;
  }

  const pattern = `%${escapeLikePattern(raw)}%`;

  try {
    const userRows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isBanned, false),
          or(
            sql`${usersTable.username} ILIKE ${pattern} ESCAPE '\\'`,
            sql`COALESCE(${usersTable.displayName}, '') ILIKE ${pattern} ESCAPE '\\'`,
          )!,
        )!,
      )
      .orderBy(desc(usersTable.id))
      .limit(14);

    const postRows = await db
      .select()
      .from(postsTable)
      .where(and(eq(postsTable.status, "approved"), sql`${postsTable.content} ILIKE ${pattern} ESCAPE '\\'`))
      .orderBy(desc(sql`COALESCE(${postsTable.boostedAt}, ${postsTable.createdAt})`), desc(postsTable.id))
      .limit(22);

    const currentUser = (req as any).user as { id: number } | undefined;
    const enrichedPosts = await enrichPosts(postRows, currentUser?.id);

    res.json({
      users: userRows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      })),
      posts: enrichedPosts,
    });
  } catch (e: any) {
    console.warn("[search]", e?.message ?? e);
    res.status(500).json({ error: "Search failed." });
  }
});

export default router;
