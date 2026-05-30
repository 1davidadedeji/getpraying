import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  parseUserId,
  subscriptionFromEvent,
  verifyRevenueCatWebhookSecret,
} from "../../lib/revenuecatWebhook";

const router: IRouter = Router();

type RevenueCatWebhookBody = {
  event?: {
    type?: string;
    app_user_id?: string;
    period_type?: string;
  };
};

function verifyWebhookAuth(req: Request, res: Response): boolean {
  const result = verifyRevenueCatWebhookSecret(
    req.headers.authorization,
    process.env.REVENUECAT_WEBHOOK_SECRET,
  );
  if (result === "not_configured") {
    res.status(503).json({ error: "Webhook not configured" });
    return false;
  }
  if (result === "unauthorized") {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
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
