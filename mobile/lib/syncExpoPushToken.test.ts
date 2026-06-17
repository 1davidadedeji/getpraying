import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { ios: { buildNumber: "1" }, android: { versionCode: 1 } },
    executionEnvironment: "storeClient",
  },
}));

vi.mock("expo-device", () => ({
  isDevice: true,
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(async () => ({
    data: "ExponentPushToken[test-token]",
  })),
}));

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";
import {
  registerAndSyncPushToken,
  resetPushTokenSyncState,
} from "./syncExpoPushToken";

describe("registerAndSyncPushToken", () => {
  beforeEach(() => {
    resetPushTokenSyncState();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ ok: true } as Response);
  });

  it("coalesces parallel calls into one POST /users/me/push-token", async () => {
    await Promise.all([
      registerAndSyncPushToken("jwt-1"),
      registerAndSyncPushToken("jwt-1"),
      registerAndSyncPushToken("jwt-1"),
    ]);

    const pushPosts = vi.mocked(apiFetch).mock.calls.filter(
      (call) => call[0] === "/users/me/push-token",
    );
    expect(pushPosts).toHaveLength(1);
  });

  it("skips duplicate POST when token and build fingerprint unchanged", async () => {
    await registerAndSyncPushToken("jwt-1");
    await registerAndSyncPushToken("jwt-1");

    const pushPosts = vi.mocked(apiFetch).mock.calls.filter(
      (call) => call[0] === "/users/me/push-token",
    );
    expect(pushPosts).toHaveLength(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
