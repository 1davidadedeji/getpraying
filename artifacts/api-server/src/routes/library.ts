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
import { eq, and, inArray, sql, desc, isNull, lte } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth";
import { enrichPosts } from "../lib/postHelpers";
import { fetchTracksForLecture, fetchTracksGroupedByLecture } from "../lib/lectureTracks";
import { filterLibrarySituationPaths } from "../lib/libraryPathCategories";
import { normalizeOfficialGuideLabel } from "../lib/officialGuideLabel";
import { resolveSanctuaryCalendarDate, resolveSanctuarySlotDates, isValidIanaTimezone } from "../lib/sanctuarySchedule";
import {
  applyPremiumOfficialForViewer,
  transformLibraryPayloadForViewer,
} from "../lib/premiumContentAccess";
import {
  getLibraryReadCache,
  isStaffLibraryUser,
  sendCachedJson,
  sendFreshJson,
  setLibraryReadCache,
} from "../lib/libraryReadCache";

const router: IRouter = Router();

/** List/card fields only — full `content` is loaded on GET /library/official/:id. */
const officialSummarySelect = {
  id: officialPrayersTable.id,
  title: officialPrayersTable.title,
  subtitle: officialPrayersTable.subtitle,
  category: officialPrayersTable.category,
  durationMinutes: officialPrayersTable.durationMinutes,
  scripture: officialPrayersTable.scripture,
  label: officialPrayersTable.label,
  audioVoice: officialPrayersTable.audioVoice,
  audioUrl: officialPrayersTable.audioUrl,
  pathId: officialPrayersTable.pathId,
  scheduleSlot: officialPrayersTable.scheduleSlot,
  scheduledDate: officialPrayersTable.scheduledDate,
  isPremium: officialPrayersTable.isPremium,
  createdAt: officialPrayersTable.createdAt,
  uploaderUsername: usersTable.username,
  uploaderDisplayName: usersTable.displayName,
} as const;

type OfficialSummaryRow = {
  id: number;
  title: string;
  subtitle: string | null;
  category: string;
  durationMinutes: number | null;
  scripture: string | null;
  label: string | null;
  audioVoice: string | null;
  audioUrl: string | null;
  pathId: number | null;
  scheduleSlot: string | null;
  scheduledDate: string | null;
  isPremium: boolean;
  createdAt: Date;
  uploaderUsername: string | null;
  uploaderDisplayName: string | null;
  updatedAt?: Date;
};

function mapOfficialSummary(p: OfficialSummaryRow) {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    category: p.category,
    durationMinutes: p.durationMinutes,
    scripture: p.scripture,
    label: normalizeOfficialGuideLabel(p.label),
    audioVoice: p.audioVoice,
    audioUrl: p.audioUrl,
    isPremium: p.isPremium,
    pathId: p.pathId,
    scheduleSlot: p.scheduleSlot,
    uploadedByUsername: p.uploaderUsername ?? null,
    uploadedByDisplayName: p.uploaderDisplayName ?? null,
    createdAt: p.createdAt,
    ...(p.updatedAt != null ? { updatedAt: p.updatedAt } : {}),
  };
}

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

function libraryCacheHit(req: import("express").Request, res: import("express").Response, cacheKey: string): boolean {
  if (isStaffLibraryUser((req as { user?: unknown }).user)) return false;
  const cached = getLibraryReadCache(cacheKey);
  if (!cached) return false;
  sendCachedJson(res, transformLibraryPayloadForViewer(cached, (req as { user?: unknown }).user));
  return true;
}

function sendLibraryPayload(
  req: import("express").Request,
  res: import("express").Response,
  cacheKey: string,
  payload: unknown,
): void {
  if (isStaffLibraryUser((req as { user?: unknown }).user)) {
    sendFreshJson(res, payload);
    return;
  }
  setLibraryReadCache(cacheKey, payload);
  sendCachedJson(res, transformLibraryPayloadForViewer(payload, (req as { user?: unknown }).user));
}

router.get("/library/official", optionalAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10), 1), 120);
  const excludeScheduled =
    req.query.excludeScheduled === "1" || req.query.excludeScheduled === "true";
  const categoryFilter =
    typeof req.query.category === "string" && req.query.category.trim().length > 0
      ? req.query.category.trim().toLowerCase()
      : null;

  const cacheKey = `official:${categoryFilter ?? "all"}:${excludeScheduled}:${limit}`;
  if (libraryCacheHit(req, res, cacheKey)) return;

  const baseOfficial = db
    .select(officialSummarySelect)
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

  const payload = {
    prayers: prayers.map((p) => ({
      ...mapOfficialSummary(p),
      scheduledDate: p.scheduledDate,
      ...(isLectureList
        ? { tracks: tracksByLecture?.get(p.id) ?? [] }
        : {}),
    })),
  };
  sendLibraryPayload(req, res, cacheKey, payload);
});

/** Current featured morning & evening sanctuary guides for a calendar day (fallback to prior days). */
router.get("/library/official/sanctuary", optionalAuth, async (req, res): Promise<void> => {
  const tzRaw = typeof req.query.timezone === "string" ? req.query.timezone.trim() : "";

  let morningDate: string | null;
  let eveningDate: string | null;

  if (tzRaw && isValidIanaTimezone(tzRaw)) {
    const dates = resolveSanctuarySlotDates(tzRaw);
    morningDate = dates.morningDate;
    eveningDate = dates.eveningDate;
  } else if (tzRaw) {
    res.status(400).json({ error: "Invalid timezone; use an IANA name (e.g. America/New_York)" });
    return;
  } else {
    const asOfDate = resolveSanctuaryCalendarDate(req.query.date);
    if (!asOfDate) {
      res.status(400).json({ error: "Invalid date; use YYYY-MM-DD" });
      return;
    }
    morningDate = asOfDate;
    eveningDate = asOfDate;
  }

  const cacheKey = `sanctuary:${morningDate}:${eveningDate}`;
  if (libraryCacheHit(req, res, cacheKey)) return;

  async function slotGuide(slot: "morning" | "evening", asOfDate: string) {
    const [row] = await db
      .select(officialSummarySelect)
      .from(officialPrayersTable)
      .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
      .where(
        and(
          eq(officialPrayersTable.scheduleSlot, slot),
          lte(officialPrayersTable.scheduledDate, asOfDate),
        ),
      )
      .orderBy(desc(officialPrayersTable.scheduledDate))
      .limit(1);
    return row ? mapOfficialSummary(row) : null;
  }

  const [morning, evening] = await Promise.all([
    slotGuide("morning", morningDate!),
    slotGuide("evening", eveningDate!),
  ]);
  const payload = { morning, evening };
  sendLibraryPayload(req, res, cacheKey, payload);
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
      isPremium: officialPrayersTable.isPremium,
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
  const viewer = (req as { user?: unknown }).user;
  const payload = applyPremiumOfficialForViewer(
    {
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
      isPremium: row.isPremium,
      uploadedByUsername: row.uploaderUsername ?? null,
      uploadedByDisplayName: row.uploaderDisplayName ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(isLecture ? { tracks: tracks ?? [] } : {}),
    },
    viewer,
  );
  if (isStaffLibraryUser(viewer)) {
    sendFreshJson(res, payload);
    return;
  }
  res.json(payload);
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
      ...officialSummarySelect,
      updatedAt: officialPrayersTable.updatedAt,
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
    prayers: rows.map((p) => mapOfficialSummary(p)),
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
  const cacheKey = "paths-list";
  if (libraryCacheHit(req, res, cacheKey)) return;

  const paths = filterLibrarySituationPaths(
    await db.select().from(prayerPathsTable),
  );
  const pathIds = paths.map((p) => p.id);
  const counts = pathIds.length > 0
    ? await db
        .select({ pathId: officialPrayersTable.pathId, count: sql<number>`count(*)` })
        .from(officialPrayersTable)
        .where(inArray(officialPrayersTable.pathId, pathIds))
        .groupBy(officialPrayersTable.pathId)
    : [];
  const countMap = new Map(counts.map(r => [r.pathId, Number(r.count)]));

  const payload = {
    paths: paths.map((path) => ({
      id: path.id,
      name: path.name,
      description: path.description ?? "",
      category: path.category,
      tagline: path.tagline,
      prayerCount: countMap.get(path.id) ?? 0,
    })),
  };
  sendLibraryPayload(req, res, cacheKey, payload);
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

  const cacheKey = `path:${pathId}:${currentUser?.id ?? "anon"}`;
  if (libraryCacheHit(req, res, cacheKey)) return;

  const officialRows = await db
    .select(officialSummarySelect)
    .from(officialPrayersTable)
    .leftJoin(usersTable, eq(officialPrayersTable.uploadedByUserId, usersTable.id))
    .where(
      and(eq(officialPrayersTable.pathId, pathId), isNull(officialPrayersTable.scheduleSlot)),
    )
    .orderBy(desc(officialPrayersTable.createdAt));

  let savedOfficialPrayers: ReturnType<typeof mapOfficialSummary>[] = [];
  if (currentUser) {
    const savedRows = await db
      .select(officialSummarySelect)
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
    savedOfficialPrayers = savedRows.map(mapOfficialSummary);
  }

  const payload = {
    id: path.id,
    name: path.name,
    description: path.description ?? "",
    category: path.category,
    tagline: path.tagline,
    officialPrayers: officialRows.map(mapOfficialSummary),
    savedOfficialPrayers,
  };
  sendLibraryPayload(req, res, cacheKey, payload);
});

/** Explore paths: admin prayer paths + official guide counts (not user post categories) */
router.get("/library/categories", optionalAuth, async (req, res): Promise<void> => {
  const cacheKey = "categories";
  if (libraryCacheHit(req, res, cacheKey)) return;

  const paths = filterLibrarySituationPaths(await db.select().from(prayerPathsTable));
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

  const payload = paths.map((p) => ({
    name: p.name,
    count: countMap.get(p.id) ?? 0,
    icon: iconForPathCategory(p.category),
    pathId: p.id,
    category: p.category,
  }));
  sendLibraryPayload(req, res, cacheKey, payload);
});

export default router;
