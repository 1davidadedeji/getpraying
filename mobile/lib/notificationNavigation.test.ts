import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `https://api.test${path}`,
  authHeaders: () => ({}),
}));

vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn() },
  Platform: { OS: "ios" },
}));

describe("parseNotificationPostId", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("parses numeric and string post ids", async () => {
    const { parseNotificationPostId } = await import("./notificationNavigation");
    expect(parseNotificationPostId(42)).toBe(42);
    expect(parseNotificationPostId("99")).toBe(99);
    expect(parseNotificationPostId(" 12 ")).toBe(12);
    expect(parseNotificationPostId("")).toBeNaN();
    expect(parseNotificationPostId(null)).toBeNaN();
    expect(parseNotificationPostId(0)).toBeNaN();
  });
});

describe("postIdFromNotificationData", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reads postId and post_id keys", async () => {
    const { postIdFromNotificationData } = await import("./notificationNavigation");
    expect(postIdFromNotificationData({ postId: "7" })).toBe(7);
    expect(postIdFromNotificationData({ post_id: 8 })).toBe(8);
    expect(postIdFromNotificationData({ type: "prayer" })).toBeNaN();
  });
});

describe("resolveNotificationTarget", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("routes prayer and comment notifications to post detail", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(resolveNotificationTarget({ type: "prayer", postId: "12" })).toEqual({
      kind: "href",
      href: "/post/12",
    });
    expect(resolveNotificationTarget({ type: "comment", postId: 3 })).toEqual({
      kind: "href",
      href: "/post/3",
    });
  });

  it("routes boost_alert with string postId to post detail", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(resolveNotificationTarget({ type: "boost_alert", postId: "55" })).toEqual({
      kind: "href",
      href: "/post/55",
    });
  });

  it("routes follow to user profile", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(
      resolveNotificationTarget({ type: "follow", actorUsername: "jane" }),
    ).toEqual({ kind: "href", href: "/user/jane" });
  });

  it("routes morning and evening prayers to library sections", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(resolveNotificationTarget({ type: "morning_prayer" })).toEqual({
      kind: "href",
      href: "/(tabs)/library?section=morning",
    });
    expect(resolveNotificationTarget({ type: "evening_prayer" })).toEqual({
      kind: "href",
      href: "/(tabs)/library?section=evening",
    });
  });

  it("routes mod_queue for staff to web admin", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(
      resolveNotificationTarget({ type: "mod_queue", postId: 9 }, { userRole: "moderator" }),
    ).toEqual({
      kind: "webAdmin",
      path: "/dashboard/moderation?postId=9",
    });
  });

  it("falls back to notifications tab when post id is missing", async () => {
    const { resolveNotificationTarget } = await import("./notificationNavigation");
    expect(resolveNotificationTarget({ type: "prayer" })).toEqual({
      kind: "href",
      href: "/(tabs)/notifications",
    });
  });
});
