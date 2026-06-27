import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("expo-router", () => ({
  router: {
    replace: (route: unknown) => replace(route),
  },
}));

import {
  __resetPostAuthNavigator,
  navigatePostAuth,
  shouldDedupePostAuthNavigation,
} from "./postAuthNavigator";

beforeEach(() => {
  replace.mockReset();
  __resetPostAuthNavigator();
});

describe("shouldDedupePostAuthNavigation", () => {
  it("drops an identical route fired within the window", () => {
    expect(shouldDedupePostAuthNavigation("/(tabs)", 1000, "/(tabs)", 1500, 1000)).toBe(true);
  });

  it("allows the same route once the window elapses", () => {
    expect(shouldDedupePostAuthNavigation("/(tabs)", 1000, "/(tabs)", 2500, 1000)).toBe(false);
  });

  it("never drops a different route", () => {
    expect(shouldDedupePostAuthNavigation("/(tabs)", 1000, "/(paywall)", 1001, 1000)).toBe(false);
  });

  it("allows the first navigation (no prior route)", () => {
    expect(shouldDedupePostAuthNavigation(null, 0, "/(tabs)", 0, 1000)).toBe(false);
  });
});

describe("navigatePostAuth", () => {
  it("collapses competing identical redirects into a single replace", () => {
    navigatePostAuth("/(tabs)" as never);
    navigatePostAuth("/(tabs)" as never);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("still routes to a different destination", () => {
    navigatePostAuth("/(tabs)" as never);
    navigatePostAuth("/(paywall)" as never);
    expect(replace).toHaveBeenCalledTimes(2);
  });
});
