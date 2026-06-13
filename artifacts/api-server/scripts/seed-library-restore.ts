/**
 * Fills gaps after partial wipes: lectures (≥3), morning/evening sanctuary if missing.
 * Does not delete path guides. For a full library reset use seed:lib-pg instead.
 *
 *   pnpm --filter @workspace/api-server run seed:library-restore
 */
import "dotenv/config";
import { readdir } from "fs/promises";
import path from "path";
import { db, officialPrayersTable, pool } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import { ensureLibraryLectures } from "./lib/seedLectures.ts";
import { formatDateYMD } from "../src/lib/sanctuarySchedule.ts";

const UPLOADS_AUDIO_BASE = "/api/static/uploads";

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

async function listLibpgAudioUrls(): Promise<string[]> {
  const dir = uploadDir();
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => n.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((n) => `${UPLOADS_AUDIO_BASE}/${n}`);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[seed-library-restore] DATABASE_URL is not set.");
    process.exit(1);
  }

  const audioUrls = await listLibpgAudioUrls();
  if (audioUrls.length === 0) {
    console.warn("[seed-library-restore] No mp3 files in uploads — run seed:lib-pg first.");
  }

  await ensureLibraryLectures(audioUrls, false);

  const [{ mCount }] = await db
    .select({ mCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.scheduleSlot, "morning"));

  if (Number(mCount ?? 0) === 0) {
    await db.insert(officialPrayersTable).values({
      title: "Morning Light with the Lord",
      subtitle: "A brief welcome before the noise of the day.",
      content:
        "Father, mercies are new this morning. Quiet my hurried spirit and help me greet this day awake to your presence.",
      category: "gratitude",
      scheduleSlot: "morning",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      scripture: "Lamentations 3:22–23",
      durationMinutes: 8,
      audioUrl: audioUrls[0] ?? null,
    });
    console.log("[seed-library-restore] Inserted morning sanctuary slot row.");
  }

  const [{ eCount }] = await db
    .select({ eCount: sql<number>`count(*)::int` })
    .from(officialPrayersTable)
    .where(eq(officialPrayersTable.scheduleSlot, "evening"));

  if (Number(eCount ?? 0) === 0) {
    await db.insert(officialPrayersTable).values({
      title: "Evening Rest in the Lord",
      subtitle: "Laying down the weight of the day.",
      content: "Father, I lay down what I cannot control. Let me rest in your care tonight.",
      category: "peace",
      scheduleSlot: "evening",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      scripture: "Psalm 4:8",
      durationMinutes: 7,
      audioUrl: audioUrls[1] ?? audioUrls[0] ?? null,
    });
    console.log("[seed-library-restore] Inserted evening sanctuary slot row.");
  }

  const badLabelRows = await db
    .select({ id: officialPrayersTable.id })
    .from(officialPrayersTable)
    .where(ilike(officialPrayersTable.label, "%official%sanctuary%"));

  if (badLabelRows.length > 0) {
    await db
      .update(officialPrayersTable)
      .set({ label: "Official Prayer" })
      .where(ilike(officialPrayersTable.label, "%official%sanctuary%"));
    console.log(
      `[seed-library-restore] Normalized ${badLabelRows.length} legacy "Official Sanctuary" label(s).`,
    );
  }

  await pool.end();
  console.log("[seed-library-restore] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
