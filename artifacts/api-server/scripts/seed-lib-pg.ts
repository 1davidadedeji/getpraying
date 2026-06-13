/**
 * Seeds the library with all prayer paths and official prayers linked to audio
 * files in artifacts/api-server/data/seed-audio (copied into data/uploads on each run).
 *
 * First two MP3s (sorted by filename) → morning & evening official prayers.
 * Remaining MP3s → “For your situation” path guides (in PATHS order; extra paths
 * share the last situation file if there are fewer audios than paths).
 *
 * Safe to run multiple times — clears and reseeds prayer_paths, path guides, sanctuary slots,
 * and the lectures carousel (3 items + tracks). Does not wipe users or feed posts.
 *
 *   pnpm --filter @workspace/api-server run seed:lib-pg
 */
import "dotenv/config";
import { copyFile, mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db, officialPrayersTable, pool, prayerPathsTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import { ensureLibraryLectures } from "./lib/seedLectures.ts";
import { formatDateYMD } from "../src/lib/sanctuarySchedule.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

/** Co-located with api-server: data/seed-audio */
function libPgSourceDir(): string {
  return path.join(__dirname, "..", "data", "seed-audio");
}

function sortMp3Files(names: string[]): string[] {
  return names
    .filter((n) => n.toLowerCase().endsWith(".mp3"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

/** Skip re-copy when dest already matches source size (faster repeat seeds). */
async function copyMp3IfChanged(src: string, dest: string): Promise<boolean> {
  const srcStat = await stat(src);
  try {
    const destStat = await stat(dest);
    if (destStat.size === srcStat.size) return false;
  } catch {
    /* dest missing — copy below */
  }
  await copyFile(src, dest);
  return true;
}

async function copyLibPgAudios(): Promise<{
  morning: string;
  evening: string;
  byPathIndex: (string | null)[];
  allUrls: string[];
}> {
  const srcDir = libPgSourceDir();
  let names: string[];
  try {
    names = sortMp3Files(await readdir(srcDir));
  } catch (e) {
    console.error("[seed-lib-pg] Could not read lib-pg folder:", srcDir, e);
    throw new Error(`[seed-lib-pg] lib-pg not readable: ${srcDir}`);
  }
  if (names.length < 2) {
    throw new Error(`[seed-lib-pg] Need at least 2 mp3 files in ${srcDir}, found ${names.length}.`);
  }

  const destRoot = uploadDir();
  await mkdir(destRoot, { recursive: true });
  const urls: string[] = [];
  let copied = 0;
  for (let i = 0; i < names.length; i++) {
    const destName = `libpg-seed-${i}.mp3`;
    const srcPath = path.join(srcDir, names[i]!);
    const destPath = path.join(destRoot, destName);
    if (await copyMp3IfChanged(srcPath, destPath)) copied += 1;
    urls.push(`/api/static/uploads/${destName}`);
  }
  console.log(
    `[seed-lib-pg] Audio ready: ${names.length} file(s) (${copied} copied, ${names.length - copied} cached) → ${destRoot}`,
  );

  const morning = urls[0]!;
  const evening = urls[1]!;
  const situationFiles = urls.slice(2);
  const byPathIndex = PATHS.map((_, idx) => {
    if (situationFiles.length === 0) return null;
    return situationFiles[Math.min(idx, situationFiles.length - 1)] ?? null;
  });
  return { morning, evening, byPathIndex, allUrls: urls };
}

const PATHS = [
  {
    name: "Anxiety & Calm",
    category: "anxiety",
  },
  {
    name: "Family",
    category: "family",
  },
  {
    name: "Forgiveness",
    category: "forgiveness",
  },
  {
    name: "Gratitude",
    category: "gratitude",
  },
  {
    name: "Grief & Loss",
    category: "grief",
  },
  {
    name: "Guidance",
    category: "guidance",
  },
  {
    name: "Healing",
    category: "healing",
  },
  {
    name: "Hope & Light",
    category: "hope",
  },
  {
    name: "Peace & Rest",
    category: "peace",
  },
  {
    name: "Relationships",
    category: "relationships",
  },
  {
    name: "Strength",
    category: "strength",
  },
  {
    name: "Wisdom",
    category: "wisdom",
  },
  {
    name: "Wealth & Success",
    category: "wealth",
  },
] as const;

/** List metadata only — full text lives in audio; keeps library API payloads small. */
const PATH_CONTENT: Record<
  string,
  { title: string; subtitle: string; scripture: string; duration: number }
> = {
  anxiety: {
    title: "When Anxiety Rises",
    subtitle: "A guided breath prayer for anxious moments",
    scripture: "Philippians 4:6–7",
    duration: 5,
  },
  family: {
    title: "Cover This Home",
    subtitle: "A prayer for family and loved ones",
    scripture: "Joshua 24:15",
    duration: 6,
  },
  forgiveness: {
    title: "Set Free to Forgive",
    subtitle: "Releasing what we cannot carry",
    scripture: "Colossians 3:13",
    duration: 6,
  },
  gratitude: {
    title: "A Heart Full of Thanks",
    subtitle: "Counting gifts in every season",
    scripture: "1 Thessalonians 5:18",
    duration: 5,
  },
  grief: {
    title: "Sitting with Sorrow",
    subtitle: "Honest lament for heavy hearts",
    scripture: "Psalm 34:18",
    duration: 5,
  },
  guidance: {
    title: "Show Me the Way",
    subtitle: "A prayer for direction and clarity",
    scripture: "Proverbs 3:5–6",
    duration: 5,
  },
  healing: {
    title: "Come and Heal",
    subtitle: "A prayer for body, mind, and spirit",
    scripture: "James 5:14–15",
    duration: 6,
  },
  hope: {
    title: "Dawn Is Coming",
    subtitle: "A prayer for light in dark seasons",
    scripture: "Romans 15:13",
    duration: 5,
  },
  peace: {
    title: "Laying the Day Down",
    subtitle: "An evening release for quiet rest",
    scripture: "Psalm 4:8",
    duration: 7,
  },
  relationships: {
    title: "Love Like You Have Loved",
    subtitle: "A prayer for connection and community",
    scripture: "John 13:34",
    duration: 6,
  },
  strength: {
    title: "Renewed in the Waiting",
    subtitle: "Courage for the worn and weary",
    scripture: "Isaiah 40:31",
    duration: 5,
  },
  wisdom: {
    title: "A Wise and Listening Heart",
    subtitle: "Seeking discernment in decisions",
    scripture: "James 1:5",
    duration: 5,
  },
  wealth: {
    title: "Steward What You've Given",
    subtitle: "Prayers for provision, work, and purpose",
    scripture: "Matthew 6:33",
    duration: 6,
  },
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[seed-lib-pg] DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("[seed-lib-pg] Clearing existing official_prayers and prayer_paths...");
  await db.delete(officialPrayersTable);
  await db.delete(prayerPathsTable);

  console.log("[seed-lib-pg] Inserting prayer paths...");
  await db.insert(prayerPathsTable).values([...PATHS]);
  const paths = await db.select().from(prayerPathsTable).orderBy(asc(prayerPathsTable.id));
  console.log(`[seed-lib-pg] Inserted ${paths.length} prayer paths.`);

  const { morning, evening, byPathIndex, allUrls } = await copyLibPgAudios();

  const categoryToPathId = new Map(paths.map((p) => [p.category, p.id]));
  const morningPathId = categoryToPathId.get("gratitude") ?? paths[0]?.id;
  const eveningPathId = categoryToPathId.get("peace") ?? paths[0]?.id;

  const rows: (typeof officialPrayersTable.$inferInsert)[] = [
    {
      title: "Morning Prayer",
      subtitle: "Start your day aligned with God's peace",
      content:
        "Lord, thank you for this new day — a gift I didn't earn and can't repay. Before the noise begins, let me hear your voice. Order my steps. Fill my mind with what is true, what is good, what is worthy of praise. Go before me into every meeting, every conversation, every moment. This day is yours.",
      category: "gratitude",
      pathId: morningPathId,
      scheduleSlot: "morning",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      audioUrl: morning,
      scripture: "Lamentations 3:22–23",
      durationMinutes: 7,
    },
    {
      title: "Evening Prayer",
      subtitle: "Release the day and rest in His care",
      content:
        "Father, I lay down what I cannot control. The day is done. Whatever was left undone, whatever was said that shouldn't have been, whatever was missed — I release it into your hands. You hold the night. Grant me peaceful rest and let me wake with new mercy tomorrow.",
      category: "peace",
      pathId: eveningPathId,
      scheduleSlot: "evening",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      audioUrl: evening,
      scripture: "Psalm 4:8",
      durationMinutes: 6,
    },
  ];

  for (let i = 0; i < paths.length; i++) {
    const pathRow = paths[i]!;
    const c = PATH_CONTENT[pathRow.category];
    if (!c) continue;
    rows.push({
      title: c.title,
      subtitle: c.subtitle,
      content: "",
      category: pathRow.category,
      pathId: pathRow.id,
      label: "Official Prayer",
      audioUrl: byPathIndex[i] ?? null,
      scripture: c.scripture,
      durationMinutes: c.duration,
    });
  }

  await db.insert(officialPrayersTable).values(rows);
  console.log(`[seed-lib-pg] Inserted ${rows.length} official prayers (2 sanctuary + ${rows.length - 2} path guides).`);

  await ensureLibraryLectures(allUrls, true);
  console.log("[seed-lib-pg] Lecture carousel seeded.");

  await pool.end();
  console.log("[seed-lib-pg] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
