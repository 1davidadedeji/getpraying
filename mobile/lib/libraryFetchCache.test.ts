import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./api";
import { clearLibraryCache, fetchLibraryCached } from "./libraryFetchCache";

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
  } as Response;
}

describe("fetchLibraryCached in-flight coalescing", () => {
  beforeEach(() => {
    clearLibraryCache();
    vi.mocked(apiFetch).mockReset();
  });

  it("fires one apiFetch for five parallel identical requests and resolves all with the same data", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(apiFetch).mockReturnValueOnce(pending);

    const path = "/library/saved-official";
    const token = "tok-a";
    const payloads = Array.from({ length: 5 }, () =>
      fetchLibraryCached<{ prayers: number[] }>(path, token),
    );

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith(path, { token, timeoutMs: undefined });

    resolveFetch(jsonResponse({ prayers: [1, 2, 3] }));

    const results = await Promise.all(payloads);
    expect(results).toEqual([
      { prayers: [1, 2, 3] },
      { prayers: [1, 2, 3] },
      { prayers: [1, 2, 3] },
      { prayers: [1, 2, 3] },
      { prayers: [1, 2, 3] },
    ]);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce requests with different cache keys", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse({ a: 1 }))
      .mockResolvedValueOnce(jsonResponse({ b: 2 }));

    const [first, second] = await Promise.all([
      fetchLibraryCached("/library/a", "token-1"),
      fetchLibraryCached("/library/b", "token-1"),
    ]);

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ a: 1 });
    expect(second).toEqual({ b: 2 });
  });

  it("shares in-flight work across callers until the first request completes", async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ ok: true }));

    await fetchLibraryCached("/library/x", null);
    await fetchLibraryCached("/library/x", null);

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses inflight coalescing when force is true", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse({ v: 1 }))
      .mockResolvedValueOnce(jsonResponse({ v: 2 }));

    const first = await fetchLibraryCached("/library/force", "t", { force: true });
    const second = await fetchLibraryCached("/library/force", "t", { force: true });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ v: 1 });
    expect(second).toEqual({ v: 2 });
  });
});
