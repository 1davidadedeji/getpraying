import { describe, expect, it, vi } from "vitest";

vi.mock("./seedUsers", () => ({
  isSeedUserId: vi.fn(async (id: number) => id === 999),
}));

import { shouldNotifyPostAuthor } from "./postEngagementNotifyPolicy";

describe("shouldNotifyPostAuthor", () => {
  it("notifies real authors for bot engagement", async () => {
    expect(await shouldNotifyPostAuthor(10, 5)).toBe(true);
  });

  it("skips seed authors and self-interaction", async () => {
    expect(await shouldNotifyPostAuthor(999, 5)).toBe(false);
    expect(await shouldNotifyPostAuthor(10, 10)).toBe(false);
    expect(await shouldNotifyPostAuthor(null, 5)).toBe(false);
  });
});
