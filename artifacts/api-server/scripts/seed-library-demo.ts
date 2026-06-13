/**
 * Inserts demo prayer paths + official guides (incl. morning/evening slots) when the library is empty.
 * Safe to run multiple times — skips if official_prayers already has rows.
 * Audio URLs use /api/static/uploads (files under data/uploads/).
 *
 *   pnpm --filter @workspace/api-server run seed:library
 */
import "dotenv/config";
import { db, officialPrayersTable, pool, prayerPathsTable } from "@workspace/db";
import { asc, sql } from "drizzle-orm";
import { formatDateYMD } from "../src/lib/sanctuarySchedule.ts";

const UPLOADS_AUDIO_BASE = "/api/static/uploads";

const DEMO_PATHS = [
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

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[seed-library-demo] DATABASE_URL is not set.");
    process.exit(1);
  }

  const [{ n: existingOfficial }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(officialPrayersTable);

  if (existingOfficial > 0) {
    console.log("[seed-library-demo] official_prayers already has rows — skipping inserts.");
    await pool.end();
    return;
  }

  let paths = await db.select().from(prayerPathsTable).orderBy(asc(prayerPathsTable.id));

  if (paths.length === 0) {
    await db.insert(prayerPathsTable).values([...DEMO_PATHS]);
    paths = await db.select().from(prayerPathsTable).orderBy(asc(prayerPathsTable.id));
    console.log(`[seed-library-demo] Inserted ${paths.length} prayer paths.`);
  }

  const first = paths[0];
  if (!first) {
    console.error("[seed-library-demo] No paths available.");
    await pool.end();
    process.exit(1);
  }

  const rows: (typeof officialPrayersTable.$inferInsert)[] = [
    {
      title: "Morning reflection (demo)",
      subtitle: "Start the day with gratitude",
      content: "Lord, thank you for this new day. Guide my steps and guard my heart.",
      category: "gratitude",
      pathId: paths.find((p) => p.category === "gratitude")?.id ?? first.id,
      scheduleSlot: "morning",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      audioUrl: `${UPLOADS_AUDIO_BASE}/demo-morning.mp3`,
      scripture: "Lamentations 3:22–23",
      durationMinutes: 5,
    },
    {
      title: "Evening reflection (demo)",
      subtitle: "Release the day and rest",
      content: "Father, I lay down what I cannot control. Grant me peaceful rest tonight.",
      category: "peace",
      pathId: paths.find((p) => p.category === "peace")?.id ?? first.id,
      scheduleSlot: "evening",
      scheduledDate: formatDateYMD(new Date()),
      label: "Official Prayer",
      audioUrl: `${UPLOADS_AUDIO_BASE}/demo-evening.mp3`,
      scripture: "Psalm 4:8",
      durationMinutes: 5,
    },
  ];

  await db.insert(officialPrayersTable).values(rows);
  console.log(`[seed-library-demo] Inserted ${rows.length} official prayers.`);

  await pool.end();
  console.log("[seed-library-demo] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
