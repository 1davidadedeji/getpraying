const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Monorepo + pnpm hoisted: watch workspace root so Metro can see packages
// installed at the workspace level (not just mobile/node_modules).
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
  ...(config.resolver.nodeModulesPaths ?? []),
];

// Metro 0.83+ added `package.json#exports` support but ships with an empty
// unstable_conditionNames list. When no condition matches, Metro errors instead
// of falling back to `main`. Adding "require" / "default" lets packages like
// @tanstack/query-core (whose exports only have "import" / "require" keys)
// resolve correctly in the React Native CommonJS context.
config.resolver.unstable_conditionNames = [
  ...(config.resolver.unstable_conditionNames ?? []),
  "require",
  "default",
];

module.exports = config;
