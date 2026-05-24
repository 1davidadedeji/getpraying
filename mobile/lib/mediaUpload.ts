import * as FileSystem from "expo-file-system/legacy";

/** Copy picked media into app cache so uploadAsync can read content:// and ph:// URIs reliably. */
export async function copyMediaToCache(localUri: string, ext: string): Promise<string> {
  const normalizedExt = ext.replace(/^\./, "").toLowerCase() || "bin";
  const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}.${normalizedExt}`;
  await FileSystem.copyAsync({ from: localUri, to: dest });
  return dest;
}

export function parseUploadBody(
  status: number,
  body: string,
): { error?: string; url?: string; mediaType?: string } {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as { error?: string; url?: string; mediaType?: string };
      if (data && typeof data === "object") return data;
    } catch {
      /* fall through */
    }
  }

  if (status === 413 || /entity too large|request entity too large|too large/i.test(trimmed)) {
    return {
      error:
        "File is too large for the server to accept. Try a shorter or lower-quality clip, or use Wi‑Fi.",
    };
  }

  if (status >= 400 && trimmed && !trimmed.startsWith("{")) {
    return { error: trimmed.slice(0, 400) };
  }

  if (status >= 400) {
    return { error: `Upload failed (${status}). Please try again.` };
  }

  return {};
}
