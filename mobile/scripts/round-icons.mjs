/**
 * Applies rounded-rectangle mask to icon.png and splash-icon.png (iOS / splash visual).
 * Run from mobile/: pnpm run round-icons (or `pnpm --filter @workspace/mobile run round-icons` from repo root)
 * Requires: pnpm add -D sharp
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, "..", "assets", "images");

async function main() {
  const sharp = (await import("sharp")).default;
  const files = ["icon.png", "splash-icon.png"];
  for (const name of files) {
    const input = path.join(imagesDir, name);
    const image = sharp(input);
    const meta = await image.metadata();
    const w = meta.width ?? 1024;
    const h = meta.height ?? 1024;
    const r = Math.round(Math.min(w, h) * 0.2);
    const maskSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/>` +
        `</svg>`,
    );
    const maskPng = await sharp(maskSvg).png().toBuffer();
    const tmp = path.join(imagesDir, `.${name}.tmp.png`);
    await sharp(input)
      .ensureAlpha()
      .composite([{ input: maskPng, blend: "dest-in" }])
      .png()
      .toFile(tmp);
    await fs.rename(tmp, input);
    // eslint-disable-next-line no-console
    console.log("[round-icons] Wrote", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
