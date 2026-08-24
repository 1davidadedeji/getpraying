import { describe, expect, it } from "vitest";
import { feedVisibleAt, isFeedItemNewerThanWatermark } from "./feedVisibleAt";

describe("feedVisibleAt", () => {
  it("uses created_at when the post was approved immediately", () => {
    const created = new Date("2026-08-01T12:00:00.000Z");
    expect(feedVisibleAt(created, null).toISOString()).toBe(created.toISOString());
    expect(feedVisibleAt(created, created).toISOString()).toBe(created.toISOString());
  });

  it("uses approved_at when moderation happens later than create", () => {
    const created = new Date("2026-08-01T12:00:00.000Z");
    const approved = new Date("2026-08-02T18:00:00.000Z");
    expect(feedVisibleAt(created, approved).toISOString()).toBe(approved.toISOString());
  });
});

describe("isFeedItemNewerThanWatermark", () => {
  it("counts a late-approved older post as new against a created_at watermark", () => {
    const watermark = new Date("2026-08-01T15:00:00.000Z");
    const createdYesterday = new Date("2026-08-01T10:00:00.000Z");
    const approvedNow = new Date("2026-08-01T16:00:00.000Z");
    expect(isFeedItemNewerThanWatermark(createdYesterday, null, watermark)).toBe(false);
    expect(isFeedItemNewerThanWatermark(createdYesterday, approvedNow, watermark)).toBe(true);
  });
});
