import { describe, expect, it } from "vitest";
import {
  buildAssetLinksPayload,
  resolveAndroidFingerprints,
} from "./appLinkConfig";

describe("resolveAndroidFingerprints", () => {
  it("returns both default fingerprints when env is empty", () => {
    const fps = resolveAndroidFingerprints("");
    expect(fps).toHaveLength(2);
    expect(fps[0]).toBe("82FE0A0CC8BC181674EC05A0B8B5070035F2C99862595BC3CBEC34883EC24D93");
    expect(fps[1]).toBe(
      "31:BC:7E:7D:CE:CB:D3:36:E8:BF:A8:83:AC:32:9A:9E:17:50:60:EB:44:1D:48:D1:56:17:13:BD:F8:2A:39:1C",
    );
  });

  it("merges env fingerprint with defaults without duplicates", () => {
    const fps = resolveAndroidFingerprints(
      "82FE0A0CC8BC181674EC05A0B8B5070035F2C99862595BC3CBEC34883EC24D93",
    );
    expect(fps).toHaveLength(2);
  });
});

describe("buildAssetLinksPayload", () => {
  it("matches web-admin assetlinks shape", () => {
    const payload = buildAssetLinksPayload({
      packageName: "com.getpraying.app",
      fingerprints: resolveAndroidFingerprints(""),
    });
    expect(payload).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.getpraying.app",
          sha256_cert_fingerprints: resolveAndroidFingerprints(""),
        },
      },
    ]);
  });
});
