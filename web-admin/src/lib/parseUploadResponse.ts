/** Parse JSON upload responses; tolerate HTML/plain 413 from nginx without CORS. */
export async function parseUploadJson(res: Response): Promise<{ error?: string; url?: string }> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json().catch(() => ({}))) as { error?: string; url?: string };
  }
  const text = (await res.text().catch(() => "")).trim();
  if (!res.ok) {
    return {
      error:
        text.slice(0, 400) ||
        (res.status === 413
          ? "File is too large for the server upload limit. Ask ops to raise nginx client_max_body_size."
          : `Upload failed (${res.status}).`),
    };
  }
  return {};
}
