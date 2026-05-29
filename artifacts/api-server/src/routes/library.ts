import { Router, type IRouter } from "express";
import {
  db,
  officialPrayersTable,
  prayerPathsTable,
  postsTable,
  savedOfficialPrayersTable,
  savedPostsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, sql, desc, isNull } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";
import { fetchTracksForLecture, fetchTracksGroupedByLecture } from "../lib/lectureTracks";
import { normalizeOfficialGuideLabel } from "../lib/officialGuideLabel";

const router: IRouter = Router();

/** Map path category slug to Feather icon key (matches mobile FEATHER_ICON_MAP) */
function iconForPathCategory(category: string): string {
  const c = category.trim().toLowerCase();
  const map: Record<string, string> = {
    anxiety: "waves",
    gratitude: "sun",
    healing: "heart-pulse",
    guidance: "compass",
    family: "users",
    health: "stethoscope",
    "work/career": "briefcase",
    finances: "dollar-sign",
    sleep: "moon",
    "growth/purpose": "sprout",
    forgiveness: "hand-heart",
    relationships: "heart",
    "mental health": "brain",
    protection: "shield",
    provision: "leaf",
    grief: "cloud",
    hope: "star",
    praise: "music",
    wisdom: "help-circle",
    peace: "cloud",
    strength: "zap",
    wealth: "dollar-sign",
    general: "star",
  };
  return map[c] ?? "star";
}

router.get("/library/official", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10), 1), 120);
  const excludeScheduled =
    req.query.excludeScheduled === "1" || req.query.excludeScheduled === "true";
  const categoryFilter =
    typeof req.query.category === "string" && req.query.category.trim().length > 0
      ? req.query.category.trim().toLowerCase()
      : null;

  const baseOfficial = db
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
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id));

  let whereClause: Parameters<typeof baseOfficial.where>[0] | undefined;
  /** Lectures are their own bucket — never mixed with sanctuary slots or path linkage in this list. */
  if (categoryFilter === "lectures") {
    whereClause = and(
      eq(officialPrayersTable.category, "lectures"),
      isNull(officialPrayersTable.scheduleSlot),
    );
  } else if (excludeScheduled && categoryFilter) {
    whereClause = and(isNull(officialPrayersTable.scheduleSlot), eq(officialPrayersTable.category, categoryFilter));
  } else if (excludeScheduled) {
    whereClause = isNull(officialPrayersTable.scheduleSlot);
  } else if (categoryFilter) {
    whereClause = eq(officialPrayersTable.category, categoryFilter);
  }

  const prayers = await (whereClause ? baseOfficial.where(whereClause) : baseOfficial)
    .orderBy(officialPrayersTable.createdAt)
    .limit(limit);

  const isLectureList = categoryFilter === "lectures";
  const tracksByLecture = isLectureList
    ? await fetchTracksGroupedByLecture(prayers.map((p) => p.id))
    : null;

  res.json({
    prayers: prayers.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      category: p.category,
      durationMinutes: p.durationMinutes,
      scripture: p.scripture,
      label: normalizeOfficialGuideLabel(p.label),
      audioVoice: p.audioVoice,
      audioUrl: p.audioUrl,
      pathId: p.pathId,
      scheduleSlot: p.scheduleSlot,
      uploadedByUsername: p.uploaderUsername ?? null,
      uploadedByDisplayName: p.uploaderDisplayName ?? null,
      createdAt: p.createdAt,
      ...(isLectureList
        ? { tracks: tracksByLecture?.get(p.id) ?? [] }
        : {}),
    })),
  });
});

/** Current featured morning & evening sanctuary guides (one row per slot, newest if duplicated). */
router.get("/library/official/sanctuary", optionalAuth, async (_req, res): Promise<void> => {
  const rows = await db
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
      scheduleSlot: officialPrayersTable.scheduleSlot,
      createdAt: officialPrayersTable.createdAt,
      uploaderUsername: usersTable.username,
      uploaderDisplayName: usersTable.displayName,
    })
    .from(officialPrayersTable)
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
    .where(inArray(officialPrayersTable.scheduleSlot, ["morning", "evening"]))
    .orderBy(desc(officialPrayersTable.createdAt));

  const mapRow = (p: (typeof rows)[number]) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    content: p.content,
    category: p.category,
    durationMinutes: p.durationMinutes,
    scripture: p.scripture,
    label: normalizeOfficialGuideLabel(p.label),
    audioVoice: p.audioVoice,
    audioUrl: p.audioUrl,
    pathId: p.pathId,
    scheduleSlot: p.scheduleSlot,
    uploadedByUsername: p.uploaderUsername ?? null,
    uploadedByDisplayName: p.uploaderDisplayName ?? null,
    createdAt: p.createdAt,
  });

  let morning: ReturnType<typeof mapRow> | null = null;
  let evening: ReturnType<typeof mapRow> | null = null;
  for (const r of rows) {
    if (r.scheduleSlot === "morning" && !morning) morning = mapRow(r);
    else if (r.scheduleSlot === "evening" && !evening) evening = mapRow(r);
    if (morning && evening) break;
  }

  res.json({ morning, evening });
});

/** Single official prayer (saved items / deep link). Registered after /sanctuary so "sanctuary" is not parsed as an id. */
router.get("/library/official/:id", optionalAuth, async (req, res): Promise<void> => {
  const raw = req.params.id;
  const id = parseInt(Array.isArray(raw) ? raw[0]! : raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
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
      scheduleSlot: officialPrayersTable.scheduleSlot,
      createdAt: officialPrayersTable.createdAt,
      updatedAt: officialPrayersTable.updatedAt,
      uploaderUsername: usersTable.username,
      uploaderDisplayName: usersTable.displayName,
    })
    .from(officialPrayersTable)
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
    .where(eq(officialPrayersTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const isLecture = row.category.toLowerCase() === "lectures";
  const tracks = isLecture ? await fetchTracksForLecture(row.id) : undefined;
  res.json({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    content: row.content,
    category: row.category,
    durationMinutes: row.durationMinutes,
    scripture: row.scripture,
    label: normalizeOfficialGuideLabel(row.label),
    audioVoice: row.audioVoice,
    audioUrl: row.audioUrl,
    pathId: row.pathId,
    scheduleSlot: row.scheduleSlot,
    uploadedByUsername: row.uploaderUsername ?? null,
    uploadedByDisplayName: row.uploaderDisplayName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(isLecture ? { tracks: tracks ?? [] } : {}),
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

router.get("/library/saved-official", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const rows = await db
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
      scheduleSlot: officialPrayersTable.scheduleSlot,
      createdAt: officialPrayersTable.createdAt,
      updatedAt: officialPrayersTable.updatedAt,
      uploaderUsername: usersTable.username,
      uploaderDisplayName: usersTable.displayName,
      savedAt: savedOfficialPrayersTable.createdAt,
    })
    .from(savedOfficialPrayersTable)
    .innerJoin(
      officialPrayersTable,
      eq(savedOfficialPrayersTable.officialPrayerId, officialPrayersTable.id),
    )
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
    .where(eq(savedOfficialPrayersTable.userId, user.id))
    .orderBy(desc(savedOfficialPrayersTable.createdAt));

  res.json({
    prayers: rows.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      category: p.category,
      durationMinutes: p.durationMinutes,
      scripture: p.scripture,
      label: normalizeOfficialGuideLabel(p.label),
      audioVoice: p.audioVoice,
      audioUrl: p.audioUrl,
      pathId: p.pathId,
      scheduleSlot: p.scheduleSlot,
      uploadedByUsername: p.uploaderUsername ?? null,
      uploadedByDisplayName: p.uploaderDisplayName ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  });
});

router.post("/library/saved-official/:prayerId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.prayerId) ? req.params.prayerId[0] : req.params.prayerId;
  const prayerId = parseInt(rawId, 10);
  const user = (req as any).user;
  if (Number.isNaN(prayerId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [op] = await db.select({ id: officialPrayersTable.id }).from(officialPrayersTable).where(eq(officialPrayersTable.id, prayerId));
  if (!op) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }

  await db
    .insert(savedOfficialPrayersTable)
    .values({ userId: user.id, officialPrayerId: prayerId })
    .onConflictDoNothing({
      target: [savedOfficialPrayersTable.userId, savedOfficialPrayersTable.officialPrayerId],
    });

  res.json({ success: true });
});

router.delete("/library/saved-official/:prayerId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.prayerId) ? req.params.prayerId[0] : req.params.prayerId;
  const prayerId = parseInt(rawId, 10);
  const user = (req as any).user;
  if (Number.isNaN(prayerId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(savedOfficialPrayersTable)
    .where(
      and(
        eq(savedOfficialPrayersTable.userId, user.id),
        eq(savedOfficialPrayersTable.officialPrayerId, prayerId),
      ),
    );

  res.json({ success: true });
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

  const officialRows = await db
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
      scheduleSlot: officialPrayersTable.scheduleSlot,
      createdAt: officialPrayersTable.createdAt,
      uploaderUsername: usersTable.username,
      uploaderDisplayName: usersTable.displayName,
    })
    .from(officialPrayersTable)
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
    .where(
      and(eq(officialPrayersTable.pathId, pathId), isNull(officialPrayersTable.scheduleSlot)),
    )
    .orderBy(desc(officialPrayersTable.createdAt));

  const mapOfficial = (p: (typeof officialRows)[number]) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    content: p.content,
    category: p.category,
    durationMinutes: p.durationMinutes,
    scripture: p.scripture,
    label: normalizeOfficialGuideLabel(p.label),
    audioVoice: p.audioVoice,
    audioUrl: p.audioUrl,
    pathId: p.pathId,
    scheduleSlot: p.scheduleSlot,
    uploadedByUsername: p.uploaderUsername ?? null,
    uploadedByDisplayName: p.uploaderDisplayName ?? null,
    createdAt: p.createdAt,
  });

  let savedOfficialPrayers: ReturnType<typeof mapOfficial>[] = [];
  if (currentUser) {
    const savedRows = await db
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
        scheduleSlot: officialPrayersTable.scheduleSlot,
        createdAt: officialPrayersTable.createdAt,
        uploaderUsername: usersTable.username,
        uploaderDisplayName: usersTable.displayName,
      })
      .from(savedOfficialPrayersTable)
      .innerJoin(
        officialPrayersTable,
        eq(savedOfficialPrayersTable.officialPrayerId, officialPrayersTable.id),
      )
      .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
      .where(
        and(
          eq(savedOfficialPrayersTable.userId, currentUser.id),
          eq(officialPrayersTable.pathId, pathId),
          isNull(officialPrayersTable.scheduleSlot),
        ),
      )
      .orderBy(officialPrayersTable.createdAt);
    savedOfficialPrayers = savedRows.map(mapOfficial);
  }

  res.json({
    id: path.id,
    name: path.name,
    description: path.description,
    category: path.category,
    tagline: path.tagline,
    officialPrayers: officialRows.map(mapOfficial),
    savedOfficialPrayers,
  });
});

/** Explore paths: admin prayer paths + official guide counts (not user post categories) */
router.get("/library/categories", optionalAuth, async (req, res): Promise<void> => {
  const paths = await db.select().from(prayerPathsTable).orderBy(prayerPathsTable.name);
  const pathIds = paths.map((p) => p.id);
  const counts =
    pathIds.length > 0
      ? await db
          .select({ pathId: officialPrayersTable.pathId, count: sql<number>`count(*)` })
          .from(officialPrayersTable)
          .where(
            and(
              inArray(officialPrayersTable.pathId, pathIds),
              isNull(officialPrayersTable.scheduleSlot),
            ),
          )
          .groupBy(officialPrayersTable.pathId)
      : [];
  const countMap = new Map(counts.map((r) => [r.pathId, Number(r.count)]));

  res.json(
    paths.map((p) => ({
      name: p.name,
      count: countMap.get(p.id) ?? 0,
      icon: iconForPathCategory(p.category),
      pathId: p.id,
      category: p.category,
    })),
  );
});

export default router;
