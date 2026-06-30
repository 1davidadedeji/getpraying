import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Mirror the tsconfig `@/*` path alias for vitest. A regex (`^@/` → `<rootDir>/`)
// keeps resolution explicit and stable for transitively-imported source modules
// (e.g. `@/lib/api`) regardless of which file pulls them in.
const aliasEntries = [{ find: /^@\//, replacement: `${rootDir}/` }];

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    alias: aliasEntries,
  },
  resolve: {
    alias: aliasEntries,
  },
});
