import { db, lectureTracksTable, type LectureTrack } from "@workspace/db";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";

export type LectureTrackInput = {
  id?: number;
  title: string;
  audioUrl: string;
  description?: string | null;
  orderIndex?: number;
};

export type LectureTrackDto = {
  id: number;
  title: string;
  audioUrl: string;
  description: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

export function mapLectureTrack(row: LectureTrack): LectureTrackDto {
  return {
    id: row.id,
    title: row.title,
    audioUrl: row.audioUrl,
    description: row.description ?? null,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function parseTracksFromBody(body: unknown): LectureTrackInput[] | undefined {
  if (body == null || typeof body !== "object" || !("tracks" in body)) return undefined;
  const raw = (body as { tracks?: unknown }).tracks;
  if (!Array.isArray(raw)) return undefined;

  const out: LectureTrackInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const audioUrl = typeof o.audioUrl === "string" ? o.audioUrl.trim() : "";
    if (!title || !audioUrl) continue;
    const idRaw = o.id;
    const id =
      typeof idRaw === "number" && Number.isFinite(idRaw) && idRaw > 0 ? Math.round(idRaw) : undefined;
    const description =
      typeof o.description === "string" && o.description.trim() ? o.description.trim() : null;
    const orderIndex =
      typeof o.orderIndex === "number" && Number.isFinite(o.orderIndex)
        ? Math.round(o.orderIndex)
        : i;
    out.push({ id, title, audioUrl, description, orderIndex });
  }
  return out;
}

export function validateLectureTracks(tracks: LectureTrackInput[]): string | null {
  if (tracks.length === 0) return "At least one audio track is required for lectures.";
  for (const t of tracks) {
    if (!t.title.trim()) return "Each track needs a title.";
    if (!t.audioUrl.trim()) return "Each track needs an audio file.";
  }
  return null;
}

export async function fetchTracksForLecture(lectureId: number): Promise<LectureTrackDto[]> {
  const rows = await db
    .select()
    .from(lectureTracksTable)
    .where(eq(lectureTracksTable.lectureId, lectureId))
    .orderBy(asc(lectureTracksTable.orderIndex), asc(lectureTracksTable.id));
  return rows.map(mapLectureTrack);
}

export async function fetchTracksGroupedByLecture(
  lectureIds: number[],
): Promise<Map<number, LectureTrackDto[]>> {
  const map = new Map<number, LectureTrackDto[]>();
  if (lectureIds.length === 0) return map;
  const rows = await db
    .select()
    .from(lectureTracksTable)
    .where(inArray(lectureTracksTable.lectureId, lectureIds))
    .orderBy(asc(lectureTracksTable.orderIndex), asc(lectureTracksTable.id));
  for (const row of rows) {
    const dto = mapLectureTrack(row);
    const list = map.get(row.lectureId) ?? [];
    list.push(dto);
    map.set(row.lectureId, list);
  }
  return map;
}

/** Insert, update, and delete tracks so the DB matches the submitted playlist. */
export async function syncLectureTracks(
  lectureId: number,
  tracks: LectureTrackInput[],
): Promise<LectureTrackDto[]> {
  const err = validateLectureTracks(tracks);
  if (err) throw new Error(err);

  await db.transaction(async (tx) => {
    const keepIds = tracks.map((t) => t.id).filter((id): id is number => id != null && id > 0);

    if (keepIds.length > 0) {
      await tx
        .delete(lectureTracksTable)
        .where(
          and(
            eq(lectureTracksTable.lectureId, lectureId),
            notInArray(lectureTracksTable.id, keepIds),
          ),
        );
    } else {
      await tx.delete(lectureTracksTable).where(eq(lectureTracksTable.lectureId, lectureId));
    }

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]!;
      const orderIndex = t.orderIndex ?? i;
      if (t.id != null && t.id > 0) {
        await tx
          .update(lectureTracksTable)
          .set({
            title: t.title.trim(),
            audioUrl: t.audioUrl.trim(),
            description: t.description ?? null,
            orderIndex,
          })
          .where(
            and(eq(lectureTracksTable.id, t.id), eq(lectureTracksTable.lectureId, lectureId)),
          );
      } else {
        await tx.insert(lectureTracksTable).values({
          lectureId,
          title: t.title.trim(),
          audioUrl: t.audioUrl.trim(),
          description: t.description ?? null,
          orderIndex,
        });
      }
    }
  });

  return fetchTracksForLecture(lectureId);
}
