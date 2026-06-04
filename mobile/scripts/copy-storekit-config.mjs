/**
 * Copies StoreKit test config into ios/ after prebuild (prebuild --clean wipes ios/).
 * Run from mobile/: pnpm run copy-storekit-config
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "Configuration.storekit");
const dest = path.join(root, "ios", "Configuration.storekit");

async function main() {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  // eslint-disable-next-line no-console
  console.log("[copy-storekit-config] Wrote ios/Configuration.storekit");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
