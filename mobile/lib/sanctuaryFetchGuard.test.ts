import { describe, expect, it } from "vitest";
import {
  beginSanctuaryFetch,
  invalidateSanctuaryFetches,
  isSanctuaryFetchStale,
} from "./sanctuaryFetchGuard";

describe("sanctuaryFetchGuard", () => {
  it("returns stale when token changes mid-fetch", () => {
    const gen = beginSanctuaryFetch("token-a");
    beginSanctuaryFetch("token-b");
    expect(isSanctuaryFetchStale("token-a", gen)).toBe(true);
    expect(isSanctuaryFetchStale("token-b", beginSanctuaryFetch("token-b"))).toBe(false);
  });

  it("invalidates all in-flight fetches", () => {
    const gen = beginSanctuaryFetch("token-a");
    invalidateSanctuaryFetches();
    expect(isSanctuaryFetchStale("token-a", gen)).toBe(true);
  });
});
