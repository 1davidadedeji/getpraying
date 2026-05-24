import { Router, type IRouter } from "express";
import { db, dailyWordOverridesTable, usersTable } from "@workspace/db";
import { eq, notLike, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import {
  parseCalendarDateString,
  resolveDailyQuote,
} from "../lib/dailyWordCatalog";
import { getDailyWordAutoRotation, setDailyWordAutoRotation } from "../lib/dailyWordSettings";

const SEED_EMAIL_SUFFIX = "@seed.getpraying.app";

const router: IRouter = Router();

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

router.get("/daily-word", async (req, res): Promise<void> => {
  const raw = typeof req.query.date === "string" ? req.query.date : "";
  const dateStr = raw.trim() || formatDateYMD(new Date());
  const parsed = parseCalendarDateString(dateStr);
  if (!parsed) {
    res.status(400).json({ error: "Invalid date; use YYYY-MM-DD" });
    return;
  }

  const [override] = await db
    .select()
    .from(dailyWordOverridesTable)
    .where(eq(dailyWordOverridesTable.effectiveDate, dateStr))
    .limit(1);

  const [{ prayingWithYou }] = await db
    .select({ prayingWithYou: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(notLike(usersTable.email, `%${SEED_EMAIL_SUFFIX}`));

  const autoRotation = await getDailyWordAutoRotation();
  const quote = resolveDailyQuote(
    parsed,
    autoRotation,
    override ? { quoteText: override.quoteText, reference: override.reference } : null,
  );

  res.json({
    date: dateStr,
    quoteText: quote.quoteText,
    reference: quote.reference,
    source: override ? ("override" as const) : ("default" as const),
    autoRotation,
    prayingWithYou,
  });
});

router.get("/admin/daily-word/settings", requireAdmin, async (_req, res): Promise<void> => {
  const autoRotation = await getDailyWordAutoRotation();
  res.json({ autoRotation });
});

router.patch("/admin/daily-word/settings", requireAdmin, async (req, res): Promise<void> => {
  const { autoRotation } = req.body ?? {};
  if (typeof autoRotation !== "boolean") {
    res.status(400).json({ error: "autoRotation (boolean) is required" });
    return;
  }
  const enabled = await setDailyWordAutoRotation(autoRotation);
  res.json({ autoRotation: enabled });
});

router.put("/admin/daily-word", requireAdmin, async (req, res): Promise<void> => {
  const { effectiveDate, quoteText, reference } = req.body ?? {};
  if (!effectiveDate || typeof quoteText !== "string" || typeof reference !== "string") {
    res.status(400).json({ error: "effectiveDate, quoteText, and reference are required" });
    return;
  }
  const parsed = parseCalendarDateString(String(effectiveDate));
  if (!parsed) {
    res.status(400).json({ error: "Invalid effectiveDate; use YYYY-MM-DD" });
    return;
  }
  const dateStr = String(effectiveDate).trim();
  const qt = quoteText.trim();
  const ref = reference.trim();
  if (!qt || !ref) {
    res.status(400).json({ error: "quoteText and reference must be non-empty" });
    return;
  }

  const [row] = await db
    .insert(dailyWordOverridesTable)
    .values({
      effectiveDate: dateStr,
      quoteText: qt,
      reference: ref,
    })
    .onConflictDoUpdate({
      target: dailyWordOverridesTable.effectiveDate,
      set: { quoteText: qt, reference: ref, updatedAt: new Date() },
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Could not save override" });
    return;
  }

  res.json({
    date: dateStr,
    quoteText: row.quoteText,
    reference: row.reference,
    source: "override" as const,
  });
});

router.delete("/admin/daily-word", requireAdmin, async (req, res): Promise<void> => {
  const raw = typeof req.query.date === "string" ? req.query.date : "";
  const dateStr = raw.trim();
  if (!dateStr || !parseCalendarDateString(dateStr)) {
    res.status(400).json({ error: "Query ?date=YYYY-MM-DD is required" });
    return;
  }

  await db.delete(dailyWordOverridesTable).where(eq(dailyWordOverridesTable.effectiveDate, dateStr));

  res.json({
    success: true,
    message: "Override cleared (default verse restored for that date)",
  });
});

export default router;
