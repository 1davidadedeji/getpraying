import { describe, expect, it, vi } from "vitest";
import { normalizeNotificationPayload } from "./notificationPayloadNormalize";

describe("normalizeNotificationPayload", () => {
  it("passes through flat postId", () => {
    expect(normalizeNotificationPayload({ type: "prayer", postId: "12" })).toMatchObject({
      type: "prayer",
      postId: "12",
    });
  });

  it("maps post_id and notification_id snake_case", () => {
    const out = normalizeNotificationPayload({
      type: "comment",
      post_id: 3,
      notification_id: 99,
    });
    expect(out.postId).toBe(3);
    expect(out.notificationId).toBe(99);
  });

  it("parses JSON string body field", () => {
    const out = normalizeNotificationPayload({
      body: JSON.stringify({ type: "prayer", postId: "7", notificationId: "1" }),
    });
    expect(out.type).toBe("prayer");
    expect(out.postId).toBe("7");
    expect(out.notificationId).toBe("1");
  });

  it("merges object body field", () => {
    const out = normalizeNotificationPayload({
      body: { type: "saved", postId: 5 },
      notificationId: 2,
    });
    expect(out.type).toBe("saved");
    expect(out.postId).toBe(5);
  });
});
