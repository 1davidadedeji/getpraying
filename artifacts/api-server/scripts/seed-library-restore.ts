/**
 * Ensures minimum Library demo data after testing wipes:
 * - At least 3 official rows with category "lectures" (carousel), no schedule slot
 * - One "morning" sanctuary slot if none exists
 * - One "evening" sanctuary slot if none exists
 * Real audio URLs use /api/static/uploads (see data/uploads/*.mp3).
 *
 * Safe to run multiple times — only inserts what is missing.
 *
 *   pnpm --filter @workspace/api-server run seed:library-restore
 */
import "dotenv/config";
import { db, officialPrayersTable, pool } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const UPLOADS_AUDIO_BASE = "/api/static/uploads";

const LECTURE_ROWS = [
  {
    title: "Abiding in the True Vine",
    subtitle: "A teaching on resting in Christ’s life within you.",
    content:
      "Jesus invites us to remain in him the way a branch stays joined to the vine—drawing strength, sap, and fruitfulness from union, not striving. Pause and ask where you have been leaning on effort alone instead of leaning on him.",
    scripture: "John 15:5",
    durationMinutes: 12,
    audioSlug: "prayer-hope",
  },
  {
    title: "Prayer as Conversation",
    subtitle: "Learning to linger with God beyond a quick list.",
    content:
      "Honest prayer is relationship: speaking, listening, and making room for silence before the Father. Bring one concern to him slowly today, phrase by phrase, and leave space to sense his kindness toward you.",
    scripture: "Philippians 4:6–7",
    durationMinutes: 16,
    audioSlug: "prayer-wisdom",
  },
  {
    title: "Scripture and Stillness",
    subtitle: "Letting the Word read us as we read it.",
    content:
      "When we open Scripture with humility, the Spirit anchors our thoughts and steadies our nerves. Choose a single verse today, speak it aloud, and sit with it for a few breaths until it begins to soften your heart.",
    scripture: "Psalm 46:10",
    durationMinutes: 20,
    audioSlug: "prayer-peace",
  },
] as const;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[seed-library-restore] DATABASE_URL is not set.");
    process.exit(1);
  }

  const [{ lectCount }] = await db
    .select({ lectCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(and(eq(officialPrayersTable.category, "lectures"), isNull(officialPrayersTable.scheduleSlot)));

  const needLectures = Math.max(0, 3 - Number(lectCount ?? 0));
  if (needLectures > 0) {
    const slice = LECTURE_ROWS.slice(0, needLectures);
    await db.insert(officialPrayersTable).values(
      slice.map((row, i) => ({
        title: row.title,
        subtitle: row.subtitle,
        content: row.content,
        category: "lectures",
        scripture: row.scripture,
        label: "Lecture",
        durationMinutes: row.durationMinutes + i,
        audioUrl: `${UPLOADS_AUDIO_BASE}/${row.audioSlug}.mp3`,
      })),
    );
    console.log(`[seed-library-restore] Inserted ${slice.length} lecture row(s).`);
  } else {
    console.log("[seed-library-restore] Lectures quota already satisfied (≥3).");
  }

  const [{ mCount }] = await db
    .select({ mCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.scheduleSlot, "morning"));

  if (Number(mCount ?? 0) === 0) {
    await db.insert(officialPrayersTable).values({
      title: "Morning Light with the Lord",
      subtitle: "A brief welcome before the noise of the day.",
      content:
        "Father, mercies are new this morning—not because everything is solved, but because you are steadfast. Quiet my hurried spirit, loosen my grip on anxiety, and help me greet this day awake to your presence. When worry surfaces, gently turn my gaze back toward your faithfulness.",
      category: "gratitude",
      scheduleSlot: "morning",
      label: "Official Prayer",
      scripture: "Lamentations 3:22–23",
      durationMinutes: 8,
      audioUrl: `${UPLOADS_AUDIO_BASE}/prayer-morning-sanctuary.mp3`,
    });
    console.log("[seed-library-restore] Inserted morning sanctuary slot row.");
  } else {
    console.log("[seed-library-restore] Morning slot already present — skipping.");
  }

  const [{ eCount }] = await db
    .select({ eCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.scheduleSlot, "evening"));

  if (Number(eCount ?? 0) === 0) {
    await db.insert(officialPrayersTable).values({
      title: "Evening Rest in the Lord",
      subtitle: "Laying down the weight of the day.",
      content:
        "Father, I lay down what I cannot control. Quiet my mind; let me rest in your care tonight. Whatever was left undone or said imperfectly, I release it to you. Thank you for walking with me through this day.",
      category: "peace",
      scheduleSlot: "evening",
      label: "Official Prayer",
      scripture: "Psalm 4:8",
      durationMinutes: 7,
      audioUrl: `${UPLOADS_AUDIO_BASE}/prayer-evening-sanctuary.mp3`,
    });
    console.log("[seed-library-restore] Inserted evening sanctuary slot row.");
  } else {
    console.log("[seed-library-restore] Evening slot already present — skipping.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
