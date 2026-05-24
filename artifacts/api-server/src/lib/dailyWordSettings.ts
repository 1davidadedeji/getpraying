import { appSettingsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";

const AUTO_ROTATION_KEY = "daily_word_auto_rotation";

export async function getDailyWordAutoRotation(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, AUTO_ROTATION_KEY))
    .limit(1);
  if (!row) return false;
  return row.value === "true";
}

export async function setDailyWordAutoRotation(enabled: boolean): Promise<boolean> {
  const value = enabled ? "true" : "false";
  await db
    .insert(appSettingsTable)
    .values({ key: AUTO_ROTATION_KEY, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
  return enabled;
}
