/** Normalize MIME for multipart uploads when the picker returns octet-stream. */
export function normalizeAudioMime(mime: string, fileName: string): string {
  const m = mime.trim().toLowerCase();
  if (m && m !== "application/octet-stream") return mime;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  return "audio/mpeg";
}
