/** Parse JSON upload responses; tolerate HTML/plain 413 from proxies. */
export async function parseUploadJson(res: Response): Promise<{
  error?: string;
  url?: string;
  mediaType?: string;
}> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json().catch(() => ({}))) as {
      error?: string;
      url?: string;
      mediaType?: string;
    };
  }
  const text = (await res.text().catch(() => "")).trim();
  if (!res.ok) {
    return {
      error:
        text.slice(0, 400) ||
        (res.status === 413
          ? "Upload was rejected (413). If the file is under the app’s size limit, configure the server or reverse proxy for larger request bodies."
          : undefined),
    };
  }
  return {};
}

/** API JSON or readable error when the body is not JSON (e.g. proxy HTML). */
export async function parseApiJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const text = (await res.text().catch(() => "")).trim();
  if (!res.ok) {
    return {
      error:
        text.slice(0, 400) ||
        (res.status === 413
          ? "Payload too large. Shorten your text and try again."
          : `Request failed (${res.status}).`),
    };
  }
  return {};
}
