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
          ? "File is too large to upload. Try a smaller file."
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
          ? "Your message is too long. Shorten it and try again."
          : `Something went wrong (${res.status}). Please try again.`),
    };
  }
  return {};
}
