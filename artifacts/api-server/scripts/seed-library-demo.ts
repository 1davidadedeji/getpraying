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

const UPLOADS_AUDIO_BASE = "/api/static/uploads";

const DEMO_PATHS = [
  {
    name: "Anxiety & Calm",
    description: "Short anchors and breath prayers for heavy days.",
    category: "anxiety",
    tagline: "You are held.",
  },
  {
    name: "Family",
    description: "Covering your home and loved ones in prayer.",
    category: "family",
    tagline: "A cord of three strands.",
  },
  {
    name: "Forgiveness",
    description: "Releasing bitterness and receiving grace.",
    category: "forgiveness",
    tagline: "As we forgive.",
  },
  {
    name: "Gratitude",
    description: "Giving thanks in all seasons.",
    category: "gratitude",
    tagline: "Counting gifts.",
  },
  {
    name: "Grief & Loss",
    description: "Walking through sorrow with grace.",
    category: "grief",
    tagline: "Grief is love with nowhere to go.",
  },
  {
    name: "Guidance",
    description: "Prayers for direction when the path is unclear.",
    category: "guidance",
    tagline: "He will direct your path.",
  },
  {
    name: "Healing",
    description: "Prayers for body, mind, and spirit.",
    category: "healing",
    tagline: "He heals the broken.",
  },
  {
    name: "Hope & Light",
    description: "When the path ahead feels dim.",
    category: "hope",
    tagline: "Dawn is coming.",
  },
  {
    name: "Peace & Rest",
    description: "Evening release and rest prayers.",
    category: "peace",
    tagline: "Be still.",
  },
  {
    name: "Relationships",
    description: "Prayers for connection and community.",
    category: "relationships",
    tagline: "Love one another.",
  },
  {
    name: "Strength",
    description: "Courage when you feel spent.",
    category: "strength",
    tagline: "He renews your strength.",
  },
  {
    name: "Wisdom",
    description: "Seeking discernment in decisions.",
    category: "wisdom",
    tagline: "Ask God first.",
  },
  {
    name: "Wealth & Success",
    description: "Stewardship, provision, and purpose.",
    category: "wealth",
    tagline: "Seek first His kingdom.",
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
