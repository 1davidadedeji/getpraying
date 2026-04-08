import { Router, type IRouter } from "express";
import { db, dailyWordOverridesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import {
  dayOfYearFromDate,
  getDefaultDailyQuote,
  parseCalendarDateString,
} from "../lib/dailyWordCatalog";

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

  if (override) {
    res.json({
      date: dateStr,
      quoteText: override.quoteText,
      reference: override.reference,
      source: "override" as const,
    });
    return;
  }

  const doy = dayOfYearFromDate(parsed);
  const def = getDefaultDailyQuote(doy);
  res.json({
    date: dateStr,
    quoteText: def.quoteText,
    reference: def.reference,
    source: "default" as const,
  });
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

  res.json({ success: true, message: "Override cleared (default rotation restored for that date)" });
});

export default router;
