import { describe, expect, it } from "vitest";
import { normalizeRouteStringParam } from "./routeParams";

describe("normalizeRouteStringParam", () => {
  it("decodes and trims string params", () => {
    expect(normalizeRouteStringParam("  sarah_a  ")).toBe("sarah_a");
    expect(normalizeRouteStringParam("marcus%20washington")).toBe("marcus washington");
  });

  it("uses the first element when expo-router provides an array", () => {
    expect(normalizeRouteStringParam(["johnsmith", "extra"])).toBe("johnsmith");
  });

  it("returns null for missing or blank params", () => {
    expect(normalizeRouteStringParam(undefined)).toBeNull();
    expect(normalizeRouteStringParam("")).toBeNull();
    expect(normalizeRouteStringParam(["", "x"])).toBeNull();
  });
});
