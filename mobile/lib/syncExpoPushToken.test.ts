import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const getExpoPushTokenAsync = vi.fn();

vi.mock("./api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => getExpoPushTokenAsync(...args),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { HIGH: 4 },
}));

vi.mock("expo-device", () => ({
  isDevice: true,
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: { eas: { projectId: "test-eas-project" } },
      ios: { buildNumber: "1" },
    },
    easConfig: { projectId: "test-eas-project" },
    executionEnvironment: "standalone",
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("@react-native-async-storage/async-storage", () => {
  const storage = {
    setItem: vi.fn(async () => undefined),
    getItem: vi.fn(async () => null),
    removeItem: vi.fn(async () => undefined),
  };
  return { default: storage, ...storage };
});

import {
  clearPushTokenOnServer,
  registerAndSyncPushToken,
  resetPushTokenSyncState,
} from "./syncExpoPushToken";

function okResponse(): Response {
  return { ok: true, text: async () => "" } as Response;
}

function postedBodies(): Array<{ token: string | null }> {
  return apiFetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body ?? "{}")));
}

describe("registerAndSyncPushToken", () => {
  beforeEach(() => {
    resetPushTokenSyncState();
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(okResponse());
    getPermissionsAsync.mockReset();
    requestPermissionsAsync.mockReset();
    getExpoPushTokenAsync.mockReset();
  });

  it("does not clear the server token when notification permission is denied", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const ok = await registerAndSyncPushToken("jwt-keep");

    expect(ok).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("does not clear the server token when the user declines the permission prompt", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const ok = await registerAndSyncPushToken("jwt-keep");

    expect(ok).toBe(false);
    expect(postedBodies().some((body) => body.token === null)).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("posts the Expo token when permission is granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted" });
    getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });

    const ok = await registerAndSyncPushToken("jwt-ok");

    expect(ok).toBe(true);
    expect(postedBodies()).toEqual([expect.objectContaining({ token: "ExponentPushToken[abc]" })]);
  });
});

describe("clearPushTokenOnServer", () => {
  beforeEach(() => {
    resetPushTokenSyncState();
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(okResponse());
  });

  it("clears the server token on logout", async () => {
    await clearPushTokenOnServer("jwt-logout");
    expect(postedBodies()).toEqual([{ token: null }]);
  });
});
