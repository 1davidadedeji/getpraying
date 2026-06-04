/**
 * Flattens icon.png onto the splash cream so launch screen / JS loading
 * show the full app tile (no transparent corners blending into the bg).
 * Run from mobile/: pnpm run generate-splash-icon
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, "..", "assets", "images");
const SPLASH_BG = "#F5EFE3";

async function main() {
  const sharp = (await import("sharp")).default;
  const input = path.join(imagesDir, "icon.png");
  const output = path.join(imagesDir, "splash-icon.png");
  await sharp(input).flatten({ background: SPLASH_BG }).png().toFile(output);
  // eslint-disable-next-line no-console
  console.log("[generate-splash-icon] Wrote splash-icon.png on", SPLASH_BG);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
