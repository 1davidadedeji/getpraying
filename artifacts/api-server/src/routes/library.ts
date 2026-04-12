import { Router, type IRouter } from "express";
import { db, officialPrayersTable, prayerPathsTable, postsTable, savedPostsTable } from "@workspace/db";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

const router: IRouter = Router();

router.get("/library/official", optionalAuth, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "20", 10);

  const prayers = await db
    .select()
    .from(officialPrayersTable)
    .orderBy(officialPrayersTable.createdAt)
    .limit(limit);

  res.json({
    prayers: prayers.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      category: p.category,
      durationMinutes: p.durationMinutes,
      scripture: p.scripture,
      label: p.label,
      audioVoice: p.audioVoice,
      createdAt: p.createdAt,
    })),
  });
});

router.get("/library/saved", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const savedRows = await db
    .select()
    .from(savedPostsTable)
    .where(eq(savedPostsTable.userId, user.id))
    .orderBy(desc(savedPostsTable.createdAt));

  if (savedRows.length === 0) {
    res.json({ posts: [] });
    return;
  }

  const postIds = savedRows.map((r) => r.postId);
  const posts = await db.select().from(postsTable).where(inArray(postsTable.id, postIds));
  const enriched = await enrichPosts(posts, user.id);
  res.json({ posts: enriched });
});

router.get("/library/paths", optionalAuth, async (req, res): Promise<void> => {
  const paths = await db.select().from(prayerPathsTable).orderBy(prayerPathsTable.createdAt);

  const result = await Promise.all(
    paths.map(async (path) => {
      const prayerCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(officialPrayersTable)
        .where(eq(officialPrayersTable.pathId, path.id));
      return {
        id: path.id,
        name: path.name,
        description: path.description,
        category: path.category,
        tagline: path.tagline,
        prayerCount: Number(prayerCount[0]?.count ?? 0),
      };
    })
  );

  res.json({ paths: result });
});

router.get("/library/paths/:pathId", optionalAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.pathId) ? req.params.pathId[0] : req.params.pathId;
  const pathId = parseInt(rawId, 10);
  const currentUser = (req as any).user;

  const [path] = await db.select().from(prayerPathsTable).where(eq(prayerPathsTable.id, pathId));
  if (!path) {
    res.status(404).json({ error: "Path not found" });
    return;
  }

  const officialPrayers = await db
    .select()
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.pathId, pathId));

  // Get saved posts for this path's category
  let savedPosts: any[] = [];
  if (currentUser) {
    const savedRows = await db
      .select()
      .from(savedPostsTable)
      .where(eq(savedPostsTable.userId, currentUser.id));

    if (savedRows.length > 0) {
      const postIds = savedRows.map((r) => r.postId);
      const posts = await db
        .select()
        .from(postsTable)
        .where(inArray(postsTable.id, postIds))
        .limit(5);
      savedPosts = await enrichPosts(posts, currentUser.id);
    }
  }

  res.json({
    id: path.id,
    name: path.name,
    description: path.description,
    category: path.category,
    tagline: path.tagline,
    officialPrayers: officialPrayers.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      category: p.category,
      durationMinutes: p.durationMinutes,
      scripture: p.scripture,
      label: p.label,
      audioVoice: p.audioVoice,
      createdAt: p.createdAt,
    })),
    savedPosts,
  });
});

router.get("/library/categories", optionalAuth, async (req, res): Promise<void> => {
  const categoryRows = await db
    .select({ category: postsTable.category, count: sql<number>`count(*)` })
    .from(postsTable)
    .where(eq(postsTable.status, "approved"))
    .groupBy(postsTable.category)
    .orderBy(desc(sql`count(*)`));

  const categories = [
    { name: "Anxiety", icon: "waves" },
    { name: "Gratitude", icon: "sun" },
    { name: "Healing", icon: "heart-pulse" },
    { name: "Guidance", icon: "compass" },
    { name: "Family", icon: "users" },
    { name: "Health", icon: "stethoscope" },
    { name: "Work/Career", icon: "briefcase" },
    { name: "Finances", icon: "dollar-sign" },
    { name: "Sleep", icon: "moon" },
    { name: "Growth/Purpose", icon: "sprout" },
    { name: "Forgiveness", icon: "hand-heart" },
    { name: "Relationships", icon: "heart" },
    { name: "Mental Health", icon: "brain" },
  ];

  const countMap = new Map(categoryRows.map((r) => [r.category, Number(r.count)]));

  res.json(
    categories.map((c) => ({
      name: c.name,
      count: countMap.get(c.name) ?? 0,
      icon: c.icon,
    }))
  );
});

export default router;
