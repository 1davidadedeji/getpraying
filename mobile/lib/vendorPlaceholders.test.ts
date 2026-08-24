import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  iosGoogleAppIdFromAndroidAppId,
  isPlaceholderFirebaseProjectId,
  isPlaceholderGcmSenderId,
  isPlaceholderGoogleApiKey,
  isPlaceholderGoogleAppId,
  isPlaceholderMetaAppId,
  isPlaceholderMetaClientToken,
  metaPluginFromEnv,
  plistStringValue,
} from "./vendorPlaceholders";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("placeholder detectors", () => {
  it("flags dummy Google API keys and accepts a real AIza key", () => {
    expect(isPlaceholderGoogleApiKey("AIzaSy000000000000000000000000000000000")).toBe(true);
    expect(isPlaceholderGoogleApiKey("AIzaSyDummyFirebaseIosApiKeyReplaceMe")).toBe(true);
    expect(isPlaceholderGoogleApiKey("")).toBe(true);
    expect(isPlaceholderGoogleApiKey("AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567")).toBe(false);
  });

  it("flags dummy Firebase project ids, sender ids, and iOS app ids", () => {
    expect(isPlaceholderFirebaseProjectId("getpraying-dummy")).toBe(true);
    expect(isPlaceholderFirebaseProjectId("example-prod")).toBe(false);
    expect(isPlaceholderGcmSenderId("123456789012")).toBe(true);
    expect(isPlaceholderGcmSenderId("998877665544")).toBe(false);
    expect(isPlaceholderGoogleAppId("1:123456789012:ios:0000000000000001")).toBe(true);
    expect(isPlaceholderGoogleAppId("1:998877665544:ios:abc123def4567890")).toBe(false);
  });

  it("flags dummy Meta app ids and client tokens", () => {
    expect(isPlaceholderMetaAppId("123456789012345")).toBe(true);
    expect(isPlaceholderMetaAppId("<META_APP_ID>")).toBe(true);
    expect(isPlaceholderMetaAppId("")).toBe(true);
    expect(isPlaceholderMetaClientToken("dummy_meta_client_token_replace_before_release")).toBe(true);
    expect(isPlaceholderMetaClientToken("")).toBe(true);
    expect(isPlaceholderMetaAppId("258193847261094")).toBe(false);
    expect(isPlaceholderMetaClientToken("a1b2c3d4e5f6789012345678")).toBe(false);
  });

  it("maps an Android mobilesdk app id onto the iOS Google App ID format", () => {
    expect(iosGoogleAppIdFromAndroidAppId("1:998877665544:android:abc123def4567890")).toBe(
      "1:998877665544:ios:abc123def4567890",
    );
  });

  it("only wires the Meta plugin when both env values are real", () => {
    expect(metaPluginFromEnv({})).toEqual([]);
    expect(
      metaPluginFromEnv({
        EXPO_PUBLIC_META_APP_ID: "123456789012345",
        EXPO_PUBLIC_META_CLIENT_TOKEN: "dummy_meta_client_token_replace_before_release",
      }),
    ).toEqual([]);
    expect(
      metaPluginFromEnv({
        EXPO_PUBLIC_META_APP_ID: "258193847261094",
        EXPO_PUBLIC_META_CLIENT_TOKEN: "a1b2c3d4e5f6789012345678",
      }),
    ).toEqual([
      [
        "react-native-fbsdk-next",
        expect.objectContaining({
          appID: "258193847261094",
          clientToken: "a1b2c3d4e5f6789012345678",
          scheme: "fb258193847261094",
        }),
      ],
    ]);
  });
});

describe("committed vendor files", () => {
  it("does not keep a dummy Google API key in google-services.json", () => {
    const json = JSON.parse(readFileSync(path.join(mobileRoot, "google-services.json"), "utf8")) as {
      project_info: { project_id: string; project_number: string };
      client: { api_key: { current_key: string }[] }[];
    };
    const apiKey = json.client[0]?.api_key[0]?.current_key ?? "";
    expect(isPlaceholderGoogleApiKey(apiKey)).toBe(false);
    expect(isPlaceholderFirebaseProjectId(json.project_info.project_id)).toBe(false);
  });

  it("does not keep dummy Firebase keys in GoogleService-Info.plist", () => {
    const plist = readFileSync(path.join(mobileRoot, "GoogleService-Info.plist"), "utf8");
    const android = JSON.parse(readFileSync(path.join(mobileRoot, "google-services.json"), "utf8")) as {
      project_info: { project_id: string; project_number: string; storage_bucket: string };
      client: { client_info: { mobilesdk_app_id: string }; api_key: { current_key: string }[] }[];
    };

    const apiKey = plistStringValue(plist, "API_KEY");
    const projectId = plistStringValue(plist, "PROJECT_ID");
    const senderId = plistStringValue(plist, "GCM_SENDER_ID");
    const bucket = plistStringValue(plist, "STORAGE_BUCKET");
    const googleAppId = plistStringValue(plist, "GOOGLE_APP_ID");

    expect(isPlaceholderGoogleApiKey(apiKey)).toBe(false);
    expect(isPlaceholderFirebaseProjectId(projectId)).toBe(false);
    expect(isPlaceholderGcmSenderId(senderId)).toBe(false);
    expect(isPlaceholderGoogleAppId(googleAppId)).toBe(false);
    expect(apiKey).toBe(android.client[0]?.api_key[0]?.current_key);
    expect(projectId).toBe(android.project_info.project_id);
    expect(senderId).toBe(android.project_info.project_number);
    expect(bucket).toBe(android.project_info.storage_bucket);
    expect(googleAppId).toBe(
      iosGoogleAppIdFromAndroidAppId(android.client[0]?.client_info.mobilesdk_app_id ?? ""),
    );
  });

  it("does not commit dummy Meta app credentials in app.json", () => {
    const raw = readFileSync(path.join(mobileRoot, "app.json"), "utf8");
    expect(raw).not.toMatch(/dummy_meta/i);
    expect(raw).not.toContain("123456789012345");
    expect(raw).not.toContain("<META_APP_ID>");
  });
});
