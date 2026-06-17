import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheFiles = new Map<string, { exists: boolean; size: number }>();

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  makeDirectoryAsync: vi.fn(async () => {}),
  getInfoAsync: vi.fn(async (path: string) => {
    const hit = cacheFiles.get(path);
    return hit ?? { exists: false, size: 0 };
  }),
  downloadAsync: vi.fn(async (remote: string, local: string) => {
    cacheFiles.set(local, { exists: true, size: 1024 });
    return { uri: local, status: 200, headers: {}, mimeType: "audio/mpeg" };
  }),
}));

vi.mock("@/lib/mediaUrl", () => ({
  resolveMediaUrl: (url: string | null | undefined) =>
    url ? `https://api.example.com${url.startsWith("/") ? url : `/${url}`}` : null,
}));

import * as FileSystem from "expo-file-system/legacy";
import { prefetchCachedAudio, resolveCachedAudioUri } from "./audioMediaCache";

describe("audioMediaCache", () => {
  beforeEach(() => {
    cacheFiles.clear();
    vi.mocked(FileSystem.downloadAsync).mockClear();
  });

  it("streams remote URL on first request and caches in the background", async () => {
    const first = await resolveCachedAudioUri("/api/static/uploads/track.mp3");
    expect(first).toBe("https://api.example.com/api/static/uploads/track.mp3");

    await vi.waitFor(() => expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(cacheFiles.size).toBe(1));

    const second = await resolveCachedAudioUri("/api/static/uploads/track.mp3");
    expect(second).toMatch(/^file:\/\/\/cache\/audio-media-cache\//);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
  });

  it("prefetch warms cache without throwing", async () => {
    prefetchCachedAudio("/api/static/uploads/other.mp3");
    await vi.waitFor(() => expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1));
  });
});
