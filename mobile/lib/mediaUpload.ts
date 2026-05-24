import * as FileSystem from "expo-file-system/legacy";
import { apiUrl, authHeaders } from "@/lib/api";

export const MAX_POST_IMAGE_BYTES = 1 * 1024 * 1024;
export const MAX_POST_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_POST_AUDIO_BYTES = 15 * 1024 * 1024;

export type PostMediaUploadKind = "image" | "video" | "audio";

export function sanitizeUploadFileName(name: string): string {
  const base = name.trim().replace(/[^\w.\-]+/g, "_") || "upload.bin";
  return base.length > 120 ? base.slice(-120) : base;
}

export function extensionFromFileName(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "bin";
}

/** Best-effort byte size for a local file URI. */
export async function getFileSizeBytes(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
      return info.size;
    }
  } catch {
    /* unreadable URI */
  }
  return 0;
}

/**
 * Copy picked media into app cache with a stable `file://` path and filename
 * so native multipart upload and server MIME/extension checks work reliably.
 */
export async function prepareMediaForUpload(
  localUri: string,
  fileName: string,
): Promise<{ uri: string; fileName: string; sizeBytes: number }> {
  const safeName = sanitizeUploadFileName(fileName);
  const ext = extensionFromFileName(safeName);
  const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.${ext}`;
  await FileSystem.copyAsync({ from: localUri, to: dest });
  const sizeBytes = await getFileSizeBytes(dest);
  return { uri: dest, fileName: safeName, sizeBytes };
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

  if (
    status === 413 ||
    /entity too large|request entity too large|too large|client_max_body_size/i.test(trimmed)
  ) {
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

function messageForUploadFailure(
  status: number,
  data: { error?: string },
  kind: PostMediaUploadKind,
): string {
  const fromServer = typeof data?.error === "string" ? data.error.trim() : "";
  if (fromServer && (status === 400 || status === 413)) {
    return fromServer;
  }
  if (status === 413) {
    if (kind === "image") return "Photo is too large. Try a different image.";
    if (kind === "video") return "Video is too large. Try a shorter or lower-quality clip.";
    return "Audio file is too large. Choose a shorter recording.";
  }
  if (status === 408 || status === 504) {
    return "Upload timed out. Check your connection and try again.";
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again and try once more.";
  }
  if (status === 0 || status < 0) {
    return "Upload could not reach the server. Check your connection and try again.";
  }
  return "Upload failed. Check your connection and try again.";
}

function maxBytesMessage(kind: PostMediaUploadKind, maxBytes: number): string {
  const mb = Math.round(maxBytes / (1024 * 1024));
  if (kind === "video") return `Choose a video under ${mb}MB.`;
  if (kind === "audio") return `Choose an audio file under ${mb}MB.`;
  return `Choose a photo under ${mb}MB.`;
}

/** Stream multipart upload via native FileSystem (avoids loading bytes into JS heap). */
export async function uploadPostMediaFile(opts: {
  localUri: string;
  token: string;
  fileName: string;
  mimeType: string;
  kind: "video" | "audio";
  maxBytes: number;
}): Promise<{ url: string; mediaType: string }> {
  const prepared = await prepareMediaForUpload(opts.localUri, opts.fileName);

  if (prepared.sizeBytes > opts.maxBytes) {
    throw new Error(maxBytesMessage(opts.kind, opts.maxBytes));
  }
  if (prepared.sizeBytes === 0) {
    throw new Error("Could not read this file. Try selecting it again from Files or your library.");
  }

  const route = opts.kind === "video" ? "post-video" : "post-audio";
  const result = await FileSystem.uploadAsync(apiUrl(`/uploads/${route}`), prepared.uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: opts.mimeType,
    headers: authHeaders(opts.token),
  });

  const data = parseUploadBody(result.status, result.body ?? "");
  if (result.status < 200 || result.status >= 300) {
    throw new Error(messageForUploadFailure(result.status, data, opts.kind));
  }
  if (typeof data?.url !== "string") {
    throw new Error("Something went wrong with the upload. Please try again.");
  }
  return { url: data.url, mediaType: data.mediaType ?? opts.kind };
}

export async function uploadPostImage(localUri: string, token: string): Promise<string> {
  const prepared = await prepareMediaForUpload(localUri, "photo.jpg");
  if (prepared.sizeBytes > MAX_POST_IMAGE_BYTES) {
    throw new Error(maxBytesMessage("image", MAX_POST_IMAGE_BYTES));
  }

  const result = await FileSystem.uploadAsync(apiUrl("/uploads/post-image"), prepared.uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: "image/jpeg",
    headers: authHeaders(token),
  });

  const data = parseUploadBody(result.status, result.body ?? "");
  if (result.status < 200 || result.status >= 300) {
    throw new Error(messageForUploadFailure(result.status, data, "image"));
  }
  if (typeof data?.url !== "string") {
    throw new Error("Something went wrong with the upload. Please try again.");
  }
  return data.url;
}

/** Validate size after preparing a cache copy (picker sizes are often wrong on Android). */
export async function assertMediaWithinLimit(
  localUri: string,
  fileName: string,
  maxBytes: number,
  kind: PostMediaUploadKind,
): Promise<{ uri: string; fileName: string; sizeBytes: number }> {
  const prepared = await prepareMediaForUpload(localUri, fileName);
  if (prepared.sizeBytes > maxBytes) {
    throw new Error(maxBytesMessage(kind, maxBytes));
  }
  if (prepared.sizeBytes === 0) {
    throw new Error("Could not read this file. Try a different clip or use Browse files.");
  }
  return prepared;
}
