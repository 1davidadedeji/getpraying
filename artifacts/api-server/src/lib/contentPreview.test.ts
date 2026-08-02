import { describe, expect, it } from "vitest";
import { buildContentPreview } from "./contentPreview";

describe("buildContentPreview", () => {
  it("returns full short text unlocked", () => {
    expect(buildContentPreview("Hello world")).toEqual({ preview: "Hello world", locked: false });
  });

  it("truncates long single block at word boundary", () => {
    const long = "word ".repeat(80).trim();
    const { preview, locked } = buildContentPreview(long);
    expect(locked).toBe(true);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThan(long.length);
  });

  it("prefers paragraph boundaries for multi-paragraph content", () => {
    const body = ["First paragraph.", "Second paragraph.", "Third paragraph.", "Fourth paragraph."].join(
      "\n\n",
    );
    const { preview, locked } = buildContentPreview(body);
    expect(locked).toBe(true);
    expect(preview).toContain("First paragraph.");
    expect(preview).not.toContain("Fourth paragraph.");
  });
});
