import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load env from repo root first, then artifacts/api-server/.env (wins on conflicts).
 * Works whether the process is started from repo root or from this package.
 */
export function loadApiEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const apiServerDir = path.resolve(here, "..");
  const repoRoot = path.resolve(apiServerDir, "../..");

  loadDotenv({ path: path.join(repoRoot, ".env") });
  loadDotenv({ path: path.join(apiServerDir, ".env"), override: true });
}
