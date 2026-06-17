import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FOCUS_FETCH_THROTTLE_MS,
  runFeedSanctuaryFocusFetch,
  runLibraryFocusFetch,
  shouldRunThrottledFocusFetch,
} from "./focusFetchThrottle";

describe("shouldRunThrottledFocusFetch", () => {
  it("uses an 8 second default throttle window", () => {
    expect(DEFAULT_FOCUS_FETCH_THROTTLE_MS).toBe(8000);
    expect(shouldRunThrottledFocusFetch(1000, 5000)).toBe(false);
    expect(shouldRunThrottledFocusFetch(1000, 9000)).toBe(true);
  });

  it("always runs when throttle is disabled", () => {
    expect(shouldRunThrottledFocusFetch(5000, 5001, 0)).toBe(true);
  });
});

describe("library focus fetch (simulated tab navigation)", () => {
  it("does not refetch within 8s when focus returns immediately", () => {
    let lastRunAt = 0;
    const loaders = {
      loadCategories: vi.fn(),
      loadSanctuary: vi.fn(),
      loadSavedOfficialIds: vi.fn(),
      loadLectures: vi.fn(),
      loadSaved: vi.fn(),
    };

    const simulateFocus = (now: number) => {
      if (!shouldRunThrottledFocusFetch(lastRunAt, now, DEFAULT_FOCUS_FETCH_THROTTLE_MS)) return;
      lastRunAt = now;
      runLibraryFocusFetch("categories", loaders);
    };

    simulateFocus(10_000);
    simulateFocus(12_000);
    simulateFocus(17_999);

    expect(loaders.loadCategories).toHaveBeenCalledTimes(1);
    expect(loaders.loadSanctuary).toHaveBeenCalledTimes(1);
    expect(loaders.loadSavedOfficialIds).toHaveBeenCalledTimes(1);
    expect(loaders.loadLectures).toHaveBeenCalledTimes(1);
  });

  it("refetches after the 8 second window elapses", () => {
    let lastRunAt = 0;
    const loaders = {
      loadCategories: vi.fn(),
      loadSanctuary: vi.fn(),
      loadSavedOfficialIds: vi.fn(),
      loadLectures: vi.fn(),
      loadSaved: vi.fn(),
    };

    const simulateFocus = (now: number) => {
      if (!shouldRunThrottledFocusFetch(lastRunAt, now, DEFAULT_FOCUS_FETCH_THROTTLE_MS)) return;
      lastRunAt = now;
      runLibraryFocusFetch("categories", loaders);
    };

    simulateFocus(10_000);
    simulateFocus(18_000);

    expect(loaders.loadCategories).toHaveBeenCalledTimes(2);
    expect(loaders.loadSanctuary).toHaveBeenCalledTimes(2);
  });

  it("loads saved tab data only when the saved tab is active", () => {
    const loaders = {
      loadCategories: vi.fn(),
      loadSanctuary: vi.fn(),
      loadSavedOfficialIds: vi.fn(),
      loadLectures: vi.fn(),
      loadSaved: vi.fn(),
    };

    runLibraryFocusFetch("saved", loaders);
    expect(loaders.loadSaved).toHaveBeenCalledTimes(1);
    expect(loaders.loadCategories).not.toHaveBeenCalled();
    expect(loaders.loadSanctuary).not.toHaveBeenCalled();
  });
});

describe("feed sanctuary focus fetch (simulated tab navigation)", () => {
  it("throttles sanctuary refresh on rapid feed tab refocus", () => {
    let lastRunAt = 0;
    const loadSanctuary = vi.fn();

    const simulateFocus = (now: number) => {
      if (!shouldRunThrottledFocusFetch(lastRunAt, now, DEFAULT_FOCUS_FETCH_THROTTLE_MS)) return;
      lastRunAt = now;
      runFeedSanctuaryFocusFetch(loadSanctuary);
    };

    simulateFocus(1_000_000);
    simulateFocus(1_004_000);
    simulateFocus(1_007_999);

    expect(loadSanctuary).toHaveBeenCalledTimes(1);

    simulateFocus(1_008_000);
    expect(loadSanctuary).toHaveBeenCalledTimes(2);
  });
});
