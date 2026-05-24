/** Normalize MIME for multipart uploads when the picker returns odd or generic types. */
export function normalizeVideoMime(mime: string, fileName: string): string {
  const m = mime.trim().toLowerCase();
  const lower = fileName.toLowerCase();

  if (m === "video/quicktime" || lower.endsWith(".mov")) return "video/quicktime";
  if (m === "video/webm" || lower.endsWith(".webm")) return "video/webm";
  if (m === "video/3gpp" || m === "video/3gp" || lower.endsWith(".3gp") || lower.endsWith(".3gpp")) {
    return "video/3gpp";
  }
  if (m === "video/x-m4v" || lower.endsWith(".m4v")) return "video/mp4";

  if (m && m !== "application/octet-stream" && m.startsWith("video/")) return mime;

  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  return "video/mp4";
}

export function videoFileNameForMime(mime: string): string {
  if (mime.includes("quicktime")) return "clip.mov";
  if (mime.includes("webm")) return "clip.webm";
  if (mime.includes("3gpp")) return "clip.3gp";
  return "clip.mp4";
}

export function videoCacheExtension(mime: string, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (mime.includes("quicktime") || lower.endsWith(".mov")) return "mov";
  if (mime.includes("webm") || lower.endsWith(".webm")) return "webm";
  if (mime.includes("3gpp") || lower.endsWith(".3gp")) return "3gp";
  return "mp4";
}
