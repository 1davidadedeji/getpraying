import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./api";
import { apiFetchGetOnce, clearInFlightGet } from "./inFlightGet";

function okResponse(): Response {
  return { ok: true } as Response;
}

describe("apiFetchGetOnce", () => {
  beforeEach(() => {
    clearInFlightGet();
    vi.mocked(apiFetch).mockReset();
  });

  it("coalesces identical GET paths until the first response settles", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(apiFetch).mockReturnValueOnce(pending);

    const path = "/posts?limit=20";
    const token = "feed-token";
    const responses = Array.from({ length: 4 }, () => apiFetchGetOnce(path, { token }));

    expect(apiFetch).toHaveBeenCalledTimes(1);

    resolveFetch(okResponse());
    const settled = await Promise.all(responses);
    expect(settled.every((r) => r.ok)).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce different paths or tokens", async () => {
    vi.mocked(apiFetch).mockResolvedValue(okResponse());

    await Promise.all([
      apiFetchGetOnce("/posts?limit=20", { token: "a" }),
      apiFetchGetOnce("/posts?limit=20", { token: "b" }),
      apiFetchGetOnce("/posts?limit=50", { token: "a" }),
    ]);

    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it("allows a new request after the prior in-flight GET completes", async () => {
    vi.mocked(apiFetch).mockResolvedValue(okResponse());

    await apiFetchGetOnce("/users/jane", { token: "t" });
    await apiFetchGetOnce("/users/jane", { token: "t" });

    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
