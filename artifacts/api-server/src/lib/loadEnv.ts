import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load env from repo root first, then artifacts/api-server/.env (wins on conflicts).
 * Works whether the process is started from repo root, bundled dist/, or src/lib/.
 */
export function loadApiEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const apiServerDir =
    [path.resolve(here, ".."), path.resolve(here, "../..")].find((dir) =>
      existsSync(path.join(dir, "package.json")),
    ) ?? path.resolve(here, "..");
  const repoRoot = path.resolve(apiServerDir, "../..");

  loadDotenv({ path: path.join(repoRoot, ".env") });
  loadDotenv({ path: path.join(apiServerDir, ".env"), override: true });
}
