import { describe, expect, it, vi } from "vitest";
import {
  requestPostDetailRefresh,
  subscribePostDetailRefresh,
} from "./postDetailRefresh";

describe("postDetailRefresh", () => {
  it("notifies subscribers for valid post ids", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePostDetailRefresh(listener);
    requestPostDetailRefresh(42);
    expect(listener).toHaveBeenCalledWith(42);
    unsubscribe();
    listener.mockClear();
    requestPostDetailRefresh(42);
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores invalid post ids", () => {
    const listener = vi.fn();
    subscribePostDetailRefresh(listener);
    requestPostDetailRefresh(0);
    requestPostDetailRefresh(NaN);
    expect(listener).not.toHaveBeenCalled();
  });
});
