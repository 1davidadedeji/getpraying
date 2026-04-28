/**
 * Seeds the library with all prayer paths and official prayers linked to audio
 * files in artifacts/api-server/data/seed-audio (copied into data/uploads on each run).
 *
 * First two MP3s (sorted by filename) → morning & evening official guides.
 * Remaining MP3s → “For your situation” path guides (in PATHS order; extra paths
 * share the last situation file if there are fewer audios than paths).
 *
 * Safe to run multiple times — clears and reseeds official_prayers and prayer_paths.
 *
 *   pnpm --filter @workspace/api-server run seed:lib-pg
 */
import "dotenv/config";
import { copyFile, mkdir, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db, officialPrayersTable, pool, prayerPathsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

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

async function copyLibPgAudios(): Promise<{
  morning: string;
  evening: string;
  byPathIndex: (string | null)[];
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
  for (let i = 0; i < names.length; i++) {
    const destName = `libpg-seed-${i}.mp3`;
    await copyFile(path.join(srcDir, names[i]!), path.join(destRoot, destName));
    urls.push(`/api/static/uploads/${destName}`);
  }
  console.log(`[seed-lib-pg] Copied ${names.length} mp3 file(s) from lib-pg → ${destRoot}`);

  const morning = urls[0]!;
  const evening = urls[1]!;
  const situationFiles = urls.slice(2);
  const byPathIndex = PATHS.map((_, idx) => {
    if (situationFiles.length === 0) return null;
    return situationFiles[Math.min(idx, situationFiles.length - 1)] ?? null;
  });
  return { morning, evening, byPathIndex };
}

const PATHS = [
  {
    name: "Anxiety",
    description: "Short anchors and breath prayers for heavy, anxious days.",
    category: "anxiety",
    tagline: "You are held.",
  },
  {
    name: "Gratitude",
    description: "Giving thanks in all seasons — good days and hard ones.",
    category: "gratitude",
    tagline: "Counting gifts.",
  },
  {
    name: "Healing",
    description: "Prayers for physical, emotional, and spiritual restoration.",
    category: "healing",
    tagline: "He heals the broken.",
  },
  {
    name: "Grief & Loss",
    description: "Walking through sorrow with grace and honest lament.",
    category: "grief",
    tagline: "Grief is love with nowhere to go.",
  },
  {
    name: "Family",
    description: "Covering your home, children, and loved ones in prayer.",
    category: "family",
    tagline: "A cord of three strands.",
  },
  {
    name: "Strength",
    description: "Finding courage and endurance when you feel spent.",
    category: "strength",
    tagline: "He renews your strength.",
  },
  {
    name: "Peace & Rest",
    description: "Evening release prayers and sleep guides.",
    category: "peace",
    tagline: "Be still.",
  },
  {
    name: "Hope & Light",
    description: "When the path ahead feels dim — dawn is coming.",
    category: "hope",
    tagline: "Dawn is coming.",
  },
  {
    name: "Forgiveness",
    description: "Releasing bitterness and receiving grace for yourself and others.",
    category: "forgiveness",
    tagline: "As we forgive.",
  },
  {
    name: "Wisdom",
    description: "Seeking discernment in decisions, big and small.",
    category: "wisdom",
    tagline: "Ask God first.",
  },
  {
    name: "Guidance",
    description: "Prayers for direction when the next step is unclear.",
    category: "guidance",
    tagline: "He will direct your path.",
  },
  {
    name: "Relationships",
    description: "Prayers for friendships, marriage, community, and connection.",
    category: "relationships",
    tagline: "Love one another.",
  },
] as const;

const PATH_CONTENT: Record<
  string,
  { title: string; subtitle: string; content: string; scripture: string; duration: number }
> = {
  anxiety: {
    title: "When Anxiety Rises",
    subtitle: "A guided breath prayer for anxious moments",
    content:
      "Lord, I bring you this anxious mind. Breathe into these tight spaces — the racing thoughts, the what-ifs. You are my peace and my anchor. I choose to cast this burden on you, knowing you care for me. Still my heart right now. Let me hear your voice above the noise.",
    scripture: "Philippians 4:6–7",
    duration: 5,
  },
  gratitude: {
    title: "A Heart Full of Thanks",
    subtitle: "Counting gifts in every season",
    content:
      "Father, open my eyes to see your goodness woven through this ordinary day. Thank you for breath, for light, for love I didn't earn. Shift my gaze from what I lack to what you've lavished. Let gratitude be the posture of my heart — not just in abundance, but in every season.",
    scripture: "1 Thessalonians 5:18",
    duration: 5,
  },
  healing: {
    title: "Come and Heal",
    subtitle: "A prayer for body, mind, and spirit",
    content:
      "Jesus, you are the same healer who touched the leper and raised the dead. I bring every broken place before you — the body that hurts, the mind that won't rest, the spirit that's weary. Lay your hand on this. I trust that your will is wholeness, and that even in pain you are working something good.",
    scripture: "James 5:14–15",
    duration: 6,
  },
  grief: {
    title: "Sitting with Sorrow",
    subtitle: "Honest lament for heavy hearts",
    content:
      "God, grief is love with nowhere to go. I'm not going to pretend I'm okay. I miss what was. I mourn what should have been. You promised to be close to the brokenhearted — so be close now. Hold this ache. I trust that weeping endures for a night and joy does come in the morning.",
    scripture: "Psalm 34:18",
    duration: 5,
  },
  family: {
    title: "Cover This Home",
    subtitle: "A prayer for family and loved ones",
    content:
      "Lord, I lift every person under my roof and in my heart. Cover my children with wisdom and protection. Strengthen the bond of love between us. Where there is tension, bring peace. Where there is distance, draw us closer. Let this home be a place where you are known and your presence is felt.",
    scripture: "Joshua 24:15",
    duration: 6,
  },
  strength: {
    title: "Renewed in the Waiting",
    subtitle: "Courage for the worn and weary",
    content:
      "Father, I have nothing left in me. My strength is spent. But you said those who wait on you will soar on wings like eagles — they will run and not grow weary. I choose to wait on you. Fill me with supernatural endurance. Let your power be made perfect in my weakness today.",
    scripture: "Isaiah 40:31",
    duration: 5,
  },
  peace: {
    title: "Laying the Day Down",
    subtitle: "An evening release for quiet rest",
    content:
      "Father, I lay down this day — the unfinished, the undone, the things I'm still turning over. You are not asleep. You hold this night. I release every worry I carried, every conversation that still stings. Grant me peaceful sleep and let me wake with new mercy. It is well.",
    scripture: "Psalm 4:8",
    duration: 7,
  },
  hope: {
    title: "Dawn Is Coming",
    subtitle: "A prayer for light in dark seasons",
    content:
      "Lord, some days it's hard to see light at the end of this tunnel. But you are the God of resurrection — you specialize in dead things coming back to life. I anchor my hope not in circumstances but in your character. You have never failed. You will not fail now. I choose hope.",
    scripture: "Romans 15:13",
    duration: 5,
  },
  forgiveness: {
    title: "Set Free to Forgive",
    subtitle: "Releasing what we cannot carry",
    content:
      "Jesus, you forgave me at tremendous cost. I want to extend that same grace — to the person who hurt me, to myself for the ways I've fallen short. Forgiveness isn't saying it didn't matter. It's refusing to let it hold me captive. Release that bitterness from my hands right now. Set me free.",
    scripture: "Colossians 3:13",
    duration: 6,
  },
  wisdom: {
    title: "A Wise and Listening Heart",
    subtitle: "Seeking discernment in decisions",
    content:
      "God of all wisdom, I don't want to lean on my own understanding. Before I decide, before I react, before I speak — I come to you. Give me eyes to see what you see, patience to wait for clarity, and courage to obey when you do speak. Let every choice I make today reflect your heart.",
    scripture: "James 1:5",
    duration: 5,
  },
  guidance: {
    title: "Show Me the Way",
    subtitle: "A prayer for direction and clarity",
    content:
      "Father, I don't always know which step to take. The path feels unclear and I'm afraid of choosing wrong. But you promised to direct my steps when I trust you. So I surrender my plans, my preferences, my timeline. Light this path. I will move when you move and wait when you say wait.",
    scripture: "Proverbs 3:5–6",
    duration: 5,
  },
  relationships: {
    title: "Love Like You Have Loved",
    subtitle: "A prayer for connection and community",
    content:
      "Lord, relationships are the hardest and holiest work. Help me to love patiently and without strings attached. Heal the ones that are strained. Deepen the ones that matter. Bring the right people into my life for this season, and let me be a safe place for others to land. Let your love flow through me.",
    scripture: "John 13:34",
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

  const { morning, evening, byPathIndex } = await copyLibPgAudios();

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
      label: "Official Guide",
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
      label: "Official Guide",
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
      content: c.content,
      category: pathRow.category,
      pathId: pathRow.id,
      label: "Official Guide",
      audioUrl: byPathIndex[i] ?? null,
      scripture: c.scripture,
      durationMinutes: c.duration,
    });
  }

  await db.insert(officialPrayersTable).values(rows);
  console.log(`[seed-lib-pg] Inserted ${rows.length} official prayers (2 sanctuary + ${rows.length - 2} path guides).`);

  await pool.end();
  console.log("[seed-lib-pg] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
