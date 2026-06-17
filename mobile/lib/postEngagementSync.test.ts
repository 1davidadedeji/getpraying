import { describe, expect, it } from "vitest";
import { updateSavedPostsList } from "./postEngagementSync";

describe("updateSavedPostsList", () => {
  const posts = [
    { id: 1, isSaved: true, content: "a" },
    { id: 2, isSaved: true, content: "b" },
  ] as const;

  it("removes unsaved posts from the list", () => {
    const updated = { id: 2, isSaved: false, content: "b" };
    expect(updateSavedPostsList([...posts], updated as any)).toEqual([posts[0]]);
  });

  it("merges saved post updates in place", () => {
    const updated = { id: 1, isSaved: true, content: "updated" };
    const result = updateSavedPostsList([...posts], updated as any);
    expect(result[0]?.content).toBe("updated");
    expect(result.length).toBe(2);
  });
});
