import express, { type Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const dbUpdateMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    update: dbUpdateMock,
  },
  usersTable: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
}));

describe("POST /webhooks/revenuecat", () => {
  let app: Express;
  const WEBHOOK_SECRET = "test-webhook-secret";

  beforeEach(async () => {
    vi.resetModules();
    dbUpdateMock.mockReset();
    process.env.REVENUECAT_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const router = (await import("./revenuecat")).default;
    app = express();
    app.use(express.json());
    app.use(router);
  });

  function authHeader(secret = WEBHOOK_SECRET) {
    return { Authorization: `Bearer ${secret}` };
  }

  function mockDbUpdateReturning(rows: Array<{ id: number }>) {
    dbUpdateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  it("returns 503 when webhook secret is not configured", async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    vi.resetModules();
    const router = (await import("./revenuecat")).default;
    const localApp = express().use(express.json()).use(router);

    const res = await request(localApp)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "RENEWAL", app_user_id: "1" } });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Webhook not configured" });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid authorization", async () => {
    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set({ Authorization: "Bearer wrong-secret" })
      .send({ event: { type: "RENEWAL", app_user_id: "1" } });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "RENEWAL" } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid webhook payload" });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it("ignores unhandled event types without touching the database", async () => {
    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "SUBSCRIBER_ALIAS", app_user_id: "9" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ignored: "SUBSCRIBER_ALIAS" });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('writes "trial" for INITIAL_PURCHASE without period_type', async () => {
    mockDbUpdateReturning([{ id: 42 }]);

    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: "42" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: 42, subscription: "trial" });
    expect(dbUpdateMock).toHaveBeenCalledOnce();
    const setArg = dbUpdateMock.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(setArg).toEqual({ subscription: "trial" });
  });

  it('writes "trial" for PRODUCT_CHANGE without period_type', async () => {
    mockDbUpdateReturning([{ id: 7 }]);

    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "PRODUCT_CHANGE", app_user_id: "7" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: 7, subscription: "trial" });
    const setArg = dbUpdateMock.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(setArg).toEqual({ subscription: "trial" });
  });

  it('writes "premium" for RENEWAL without period_type', async () => {
    mockDbUpdateReturning([{ id: 3 }]);

    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "RENEWAL", app_user_id: "3", period_type: "NORMAL" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: 3, subscription: "premium" });
    const setArg = dbUpdateMock.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(setArg).toEqual({ subscription: "premium" });
  });

  it('writes "free" for CANCELLATION and EXPIRATION', async () => {
    mockDbUpdateReturning([{ id: 5 }]);

    for (const type of ["CANCELLATION", "EXPIRATION"] as const) {
      dbUpdateMock.mockClear();
      mockDbUpdateReturning([{ id: 5 }]);

      const res = await request(app)
        .post("/webhooks/revenuecat")
        .set(authHeader())
        .send({ event: { type, app_user_id: "5" } });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, userId: 5, subscription: "free" });
      const setArg = dbUpdateMock.mock.results[0]?.value.set.mock.calls[0]?.[0];
      expect(setArg).toEqual({ subscription: "free" });
    }
  });

  it("returns 404 when the user id does not exist", async () => {
    mockDbUpdateReturning([]);

    const res = await request(app)
      .post("/webhooks/revenuecat")
      .set(authHeader())
      .send({ event: { type: "RENEWAL", app_user_id: "999", period_type: "NORMAL" } });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });
});
