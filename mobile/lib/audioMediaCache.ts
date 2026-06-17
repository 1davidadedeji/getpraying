import * as FileSystem from "expo-file-system/legacy";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const CACHE_DIR = `${FileSystem.cacheDirectory}audio-media-cache/`;

const inflightDownloads = new Map<string, Promise<void>>();

function cacheFileName(remoteUrl: string): string {
  let hash = 0;
  for (let i = 0; i < remoteUrl.length; i++) {
    hash = (Math.imul(31, hash) + remoteUrl.charCodeAt(i)) | 0;
  }
  const extMatch = remoteUrl.match(/\.(mp3|m4a|wav|aac|ogg|opus)(\?|#|$)/i);
  const ext = extMatch?.[1]?.toLowerCase() ?? "mp3";
  return `${(hash >>> 0).toString(36)}.${ext}`;
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function scheduleBackgroundDownload(remoteUrl: string, localPath: string): void {
  if (inflightDownloads.has(remoteUrl)) return;
  const job = ensureCacheDir()
    .then(() => FileSystem.downloadAsync(remoteUrl, localPath))
    .then(() => undefined)
    .catch(() => {
      /* keep streaming from remote on next play */
    })
    .finally(() => inflightDownloads.delete(remoteUrl));
  inflightDownloads.set(remoteUrl, job);
}

/**
 * Returns a local file URI when cached; otherwise the remote URL for streaming
 * and schedules a background download for instant replay later.
 */
export async function resolveCachedAudioUri(
  audioUrl: string | null | undefined,
): Promise<string | null> {
  const remote = resolveMediaUrl(audioUrl);
  if (!remote) return null;
  if (remote.startsWith("file://")) return remote;

  await ensureCacheDir();
  const localPath = `${CACHE_DIR}${cacheFileName(remote)}`;
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists && typeof info.size === "number" && info.size > 0) {
    return localPath;
  }

  scheduleBackgroundDownload(remote, localPath);
  return remote;
}

/** Warm the cache without blocking playback. */
export function prefetchCachedAudio(audioUrl: string | null | undefined): void {
  void resolveCachedAudioUri(audioUrl);
}
