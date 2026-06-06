/** Default read timeout for API requests (physical iOS can hang without one). */
export const DEFAULT_API_TIMEOUT_MS = 20_000;

export class FetchTimeoutError extends Error {
  readonly name = "FetchTimeoutError";

  constructor(
    readonly timeoutMs: number,
    readonly url?: string,
  ) {
    super(
      url
        ? `Request timed out after ${timeoutMs}ms: ${url}`
        : `Request timed out after ${timeoutMs}ms`,
    );
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
  return (input as Request).url;
}

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number;
};

/**
 * `fetch` with an AbortController timeout. Rejects with {@link FetchTimeoutError}
 * when the deadline is exceeded.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const { timeoutMs: _omit, signal: outerSignal, ...rest } = init ?? {};

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const onOuterAbort = () => ctrl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timer);
      ctrl.abort();
    } else {
      outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }
  }

  try {
    return await fetch(input, { ...rest, signal: ctrl.signal });
  } catch (err) {
    if (ctrl.signal.aborted) {
      throw new FetchTimeoutError(timeoutMs, resolveUrl(input));
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
  }
}
