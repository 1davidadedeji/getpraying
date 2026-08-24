import { afterEach, describe, expect, it } from "vitest";
import {
  createSignedMediaUrl,
  normalizeMediaStoragePath,
  verifySignedMediaToken,
} from "./signedMediaUrl";

describe("signedMediaUrl", () => {
  afterEach(() => {
    delete process.env.MEDIA_SIGNING_SECRET;
    delete process.env.JWT_SECRET;
  });

  it("normalizes API upload paths", () => {
    expect(normalizeMediaStoragePath("/api/static/uploads/demo.mp3")).toBe("demo.mp3");
  });

  it("creates and verifies a signed media URL", () => {
    process.env.JWT_SECRET = "test-signing-secret";
    const signed = createSignedMediaUrl("/api/static/uploads/premium.mp3", 3600);
    expect(signed).toMatch(/^\/api\/media\//);
    const token = signed!.slice("/api/media/".length);
    const verified = verifySignedMediaToken(token);
    expect(verified?.storagePath).toBe("premium.mp3");
  });

  it("rejects tampered tokens", () => {
    process.env.JWT_SECRET = "test-signing-secret";
    const signed = createSignedMediaUrl("/api/static/uploads/premium.mp3", 3600)!;
    const token = `${signed.slice("/api/media/".length)}x`;
    expect(verifySignedMediaToken(token)).toBeNull();
  });
});
