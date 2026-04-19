/**
 * Inserts demo prayer paths + official guides (incl. morning/evening slots) when the library is empty.
 * Safe to run multiple times — skips if official_prayers already has rows.
 *
 *   pnpm --filter @workspace/api-server run seed:library
 */
import "dotenv/config";
import { db, officialPrayersTable, pool, prayerPathsTable } from "@workspace/db";
import { asc, sql } from "drizzle-orm";

const DEMO_PATHS = [
  {
    name: "Anxiety & Calm",
    description: "Short anchors and breath prayers for heavy days.",
    category: "anxiety",
    tagline: "You are held.",
  },
  {
    name: "Gratitude",
    description: "Giving thanks in all seasons.",
    category: "gratitude",
    tagline: "Counting gifts.",
  },
  {
    name: "Hope & Light",
    description: "When the path ahead feels dim.",
    category: "hope",
    tagline: "Dawn is coming.",
  },
  {
    name: "Peace & Rest",
    description: "Evening release and sleep prayers.",
    category: "peace",
    tagline: "Be still.",
  },
  {
    name: "Wisdom",
    description: "Seeking discernment in decisions.",
    category: "wisdom",
    tagline: "Ask God first.",
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
      subtitle: "Replace from admin when ready",
      content:
        "Lord, thank you for this new day. Order my thoughts around your peace before I step into what’s ahead.",
      category: "gratitude",
      pathId: first.id,
      scheduleSlot: "morning",
      label: "Official Guide",
      scripture: "Lamentations 3:22–23",
    },
    {
      title: "Evening release (demo)",
      subtitle: "Replace from admin when ready",
      content:
        "Father, I lay down what I cannot control. Quiet my mind; let me rest in your care tonight.",
      category: "peace",
      pathId: first.id,
      scheduleSlot: "evening",
      label: "Official Guide",
      scripture: "Psalm 4:8",
    },
  ];

  for (const p of paths.slice(0, 5)) {
    rows.push({
      title: `On the path: ${p.name}`,
      subtitle: "Sample official guide",
      content: `A gentle guided moment for the “${p.name}” journey. Swap this copy and attach audio from the admin panel.`,
      category: p.category,
      pathId: p.id,
      label: "Official Guide",
      scripture: "Philippians 4:6",
    });
  }

  await db.insert(officialPrayersTable).values(rows);
  console.log(`[seed-library-demo] Inserted ${rows.length} official prayers (incl. morning/evening).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
