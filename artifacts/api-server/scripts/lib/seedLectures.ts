/**
 * Inserts Library lecture carousel rows (category "lectures") + lecture_tracks.
 * Uses uploaded MP3 URLs from seed-lib-pg (libpg-seed-*.mp3).
 */
import { db, lectureTracksTable, officialPrayersTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const LECTURE_ROWS = [
  {
    title: "Abiding in the True Vine",
    subtitle: "A teaching on resting in Christ’s life within you.",
    content:
      "Jesus invites us to remain in him the way a branch stays joined to the vine. Pause and ask where you have been leaning on effort alone instead of leaning on him.",
    scripture: "John 15:5",
    durationMinutes: 12,
    tracks: [
      { title: "Part 1 — Remaining in Christ", description: "Why abiding is relationship, not performance." },
      { title: "Part 2 — Fruit from the Vine", description: "Letting his life flow through your prayers today." },
    ],
  },
  {
    title: "Prayer as Conversation",
    subtitle: "Learning to linger with God beyond a quick list.",
    content:
      "Honest prayer is relationship: speaking, listening, and making room for silence before the Father.",
    scripture: "Philippians 4:6–7",
    durationMinutes: 16,
    tracks: [{ title: "Part 1 — Speaking honestly", description: "Bringing your whole heart before God." }],
  },
  {
    title: "Scripture and Stillness",
    subtitle: "Letting the Word read us as we read it.",
    content:
      "When we open Scripture with humility, the Spirit anchors our thoughts and steadies our nerves.",
    scripture: "Psalm 46:10",
    durationMinutes: 20,
    tracks: [
      { title: "Part 1 — Be still", description: "Slowing down to hear God in his Word." },
      { title: "Part 2 — Meditating on one verse", description: "A simple rhythm for daily Scripture prayer." },
      { title: "Part 3 — Carrying it into the day", description: "Letting the verse shape your conversations with God." },
    ],
  },
] as const;

function pickAudioUrl(audioUrls: string[], trackIndex: number, lectureIndex: number): string | null {
  if (audioUrls.length === 0) return null;
  const base = 2 + lectureIndex * 4 + trackIndex;
  return audioUrls[base % audioUrls.length] ?? audioUrls[0] ?? null;
}

/**
 * Ensures at least 3 lecture carousel items exist.
 * @param audioUrls MP3 URLs under /api/static/uploads (from seed-lib-pg copy).
 * @param replaceExisting When true, deletes existing lectures + tracks first (used after lib-pg wipe).
 */
export async function ensureLibraryLectures(
  audioUrls: string[],
  replaceExisting = false,
): Promise<number> {
  if (replaceExisting) {
    const existing = await db
      .select({ id: officialPrayersTable.id })
      .from(officialPrayersTable)
      .where(and(eq(officialPrayersTable.category, "lectures"), isNull(officialPrayersTable.scheduleSlot)));
    if (existing.length > 0) {
      await db
        .delete(officialPrayersTable)
        .where(and(eq(officialPrayersTable.category, "lectures"), isNull(officialPrayersTable.scheduleSlot)));
    }
  }

  const [{ lectCount }] = await db
    .select({ lectCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(and(eq(officialPrayersTable.category, "lectures"), isNull(officialPrayersTable.scheduleSlot)));

  const need = replaceExisting ? LECTURE_ROWS.length : Math.max(0, LECTURE_ROWS.length - Number(lectCount ?? 0));
  if (need === 0) {
    console.log("[seed-lectures] Lectures quota already satisfied (≥3).");
    return 0;
  }

  const slice = LECTURE_ROWS.slice(0, need);
  let inserted = 0;

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i]!;
    const [op] = await db
      .insert(officialPrayersTable)
      .values({
        title: row.title,
        subtitle: row.subtitle,
        content: row.content,
        category: "lectures",
        scripture: row.scripture,
        label: "Lecture",
        durationMinutes: row.durationMinutes + i,
        audioUrl: pickAudioUrl(audioUrls, 0, i),
      })
      .returning({ id: officialPrayersTable.id });

    if (!op?.id) continue;

    const fallbackUrl = pickAudioUrl(audioUrls, 0, i) ?? audioUrls[0];
    if (!fallbackUrl) {
      console.warn(`[seed-lectures] Skipping tracks for "${row.title}" — no audio URLs.`);
      continue;
    }
    await db.insert(lectureTracksTable).values(
      row.tracks.map((track, orderIndex) => ({
        lectureId: op.id,
        title: track.title,
        description: track.description,
        audioUrl: pickAudioUrl(audioUrls, orderIndex + 1, i) ?? fallbackUrl,
        orderIndex,
      })),
    );
    inserted += 1;
  }

  console.log(`[seed-lectures] Inserted ${inserted} lecture(s) with audio tracks.`);
  return inserted;
}
