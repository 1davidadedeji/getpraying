import { Router, type IRouter } from "express";
import { db, officialPrayersTable, prayerPathsTable, postsTable, savedPostsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";

const router: IRouter = Router();

router.get("/library/official", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10), 1), 50);

  const prayers = await db
    .select({
      id: officialPrayersTable.id,
      title: officialPrayersTable.title,
      subtitle: officialPrayersTable.subtitle,
      content: officialPrayersTable.content,
      category: officialPrayersTable.category,
      durationMinutes: officialPrayersTable.durationMinutes,
      scripture: officialPrayersTable.scripture,
      label: officialPrayersTable.label,
      audioVoice: officialPrayersTable.audioVoice,
      audioUrl: officialPrayersTable.audioUrl,
      pathId: officialPrayersTable.pathId,
      uploadedByUserId: officialPrayersTable.uploadedByUserId,
      scheduleSlot: officialPrayersTable.scheduleSlot,
      createdAt: officialPrayersTable.createdAt,
      uploaderUsername: usersTable.username,
      uploaderDisplayName: usersTable.displayName,
    })
    .from(officialPrayersTable)
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
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
      audioUrl: p.audioUrl,
      pathId: p.pathId,
      scheduleSlot: p.scheduleSlot,
      uploadedByUsername: p.uploaderUsername ?? null,
      uploadedByDisplayName: p.uploaderDisplayName ?? null,
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
  const idOrder = new Map(postIds.map((id, i) => [id, i]));
  enriched.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  res.json({ posts: enriched });
});

router.get("/library/paths", optionalAuth, async (req, res): Promise<void> => {
  const paths = await db.select().from(prayerPathsTable).orderBy(prayerPathsTable.createdAt);
  const pathIds = paths.map(p => p.id);
  const counts = pathIds.length > 0
    ? await db
        .select({ pathId: officialPrayersTable.pathId, count: sql<number>`count(*)` })
        .from(officialPrayersTable)
        .where(inArray(officialPrayersTable.pathId, pathIds))
        .groupBy(officialPrayersTable.pathId)
    : [];
  const countMap = new Map(counts.map(r => [r.pathId, Number(r.count)]));

  const result = paths.map(path => ({
    id: path.id,
    name: path.name,
    description: path.description,
    category: path.category,
    tagline: path.tagline,
    prayerCount: countMap.get(path.id) ?? 0,
  }));

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
        .where(and(inArray(postsTable.id, postIds), eq(postsTable.category, path.category)))
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
    { name: "Protection", icon: "shield" },
    { name: "Provision", icon: "leaf" },
    { name: "Grief", icon: "cloud" },
    { name: "Hope", icon: "star" },
    { name: "Praise", icon: "music" },
    { name: "Wisdom", icon: "help-circle" },
    { name: "Peace", icon: "cloud" },
  ];

  const countMap = new Map(categoryRows.map((r) => [(r.category ?? "").toLowerCase(), Number(r.count)]));

  res.json(
    categories.map((c) => ({
      name: c.name,
      count: countMap.get(c.name.toLowerCase()) ?? 0,
      icon: c.icon,
    }))
  );
});

export default router;
