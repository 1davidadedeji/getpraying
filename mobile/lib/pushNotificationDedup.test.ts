import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe("pushNotificationDedup", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("claims cold-start id once across persisted storage", async () => {
    const { claimNotificationResponseId } = await import("./pushNotificationDedup");
    await expect(claimNotificationResponseId("cold-1")).resolves.toBe(true);
    await expect(claimNotificationResponseId("cold-1")).resolves.toBe(false);
  });

  it("dedupes in-session taps", async () => {
    const { claimNotificationResponseInSession } = await import("./pushNotificationDedup");
    expect(claimNotificationResponseInSession("tap-1")).toBe(true);
    expect(claimNotificationResponseInSession("tap-1")).toBe(false);
    expect(claimNotificationResponseInSession("tap-2")).toBe(true);
  });
});
