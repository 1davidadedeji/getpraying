import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const PREMIUM_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]);
const FREE_EVENTS = new Set(["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]);

type RevenueCatWebhookBody = {
  event?: {
    type?: string;
    app_user_id?: string;
    period_type?: string;
  };
};

function verifyWebhookAuth(req: Request, res: Response): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "Webhook not configured" });
    return false;
  }
  const header = req.headers.authorization ?? "";
  const expected = `Bearer ${secret}`;
  if (header !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function parseUserId(appUserId: string | undefined): number | null {
  if (!appUserId?.trim()) return null;
  const id = Number.parseInt(appUserId.trim(), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function subscriptionFromEvent(
  eventType: string,
  periodType: string | undefined,
): "premium" | "trial" | "free" | null {
  if (FREE_EVENTS.has(eventType)) return "free";
  if (!PREMIUM_EVENTS.has(eventType)) return null;

  const period = String(periodType ?? "").toUpperCase();
  if (period === "TRIAL" || period === "INTRO") return "trial";
  // INITIAL_PURCHASE / PRODUCT_CHANGE without period_type is almost always a store free
  // trial or tier switch mid-trial — treat as trial so auto-boost stays blocked until
  // the first paid renewal webhook arrives.
  if ((eventType === "INITIAL_PURCHASE" || eventType === "PRODUCT_CHANGE") && !period) {
    return "trial";
  }
  return "premium";
}

router.post("/webhooks/revenuecat", async (req, res): Promise<void> => {
  if (!verifyWebhookAuth(req, res)) return;

  const body = req.body as RevenueCatWebhookBody;
  const eventType = body.event?.type;
  const userId = parseUserId(body.event?.app_user_id);

  if (!eventType || userId == null) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  const subscription = subscriptionFromEvent(eventType, body.event?.period_type);
  if (subscription == null) {
    res.json({ ok: true, ignored: eventType });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ subscription })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ ok: true, userId: updated.id, subscription });
});

export default router;
