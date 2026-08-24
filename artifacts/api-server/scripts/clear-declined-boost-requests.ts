/**
 * One-off maintenance: declined posts should not hold boost_requested forever.
 * Run from repo root: npx tsx artifacts/api-server/scripts/clear-declined-boost-requests.ts
 */
import { loadApiEnv } from "../src/lib/loadEnv";

loadApiEnv();

import { db, postsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

async function main(): Promise<void> {
  const updated = await db
    .update(postsTable)
    .set({ boostRequested: false })
    .where(and(eq(postsTable.status, "declined"), eq(postsTable.boostRequested, true)))
    .returning({ id: postsTable.id });

  console.info(`Cleared boost_requested on ${updated.length} declined post(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
