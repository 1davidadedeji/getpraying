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

router.post("/webhooks/revenuecat", async (req, res): Promise<void> => {
  if (!verifyWebhookAuth(req, res)) return;

  const body = req.body as RevenueCatWebhookBody;
  const eventType = body.event?.type;
  const userId = parseUserId(body.event?.app_user_id);

  if (!eventType || userId == null) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  let subscription: "premium" | "free" | null = null;
  if (PREMIUM_EVENTS.has(eventType)) {
    subscription = "premium";
  } else if (FREE_EVENTS.has(eventType)) {
    subscription = "free";
  }

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
