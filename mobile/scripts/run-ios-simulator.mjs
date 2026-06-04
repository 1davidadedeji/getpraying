/**
 * Runs expo run:ios on an iOS Simulator (never a plugged-in iPhone).
 * Usage: node ./scripts/run-ios-simulator.mjs [Simulator Name]
 * Default simulator: iPhone 17 Pro
 */
import { execSync, spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.join(__dirname, "..");
const preferredName = process.argv[2] ?? "iPhone 17 Pro";

function listSimulators() {
  const raw = execSync("xcrun simctl list devices available -j", {
    encoding: "utf8",
  });
  const { devices } = JSON.parse(raw);
  const out = [];
  for (const runtime of Object.keys(devices)) {
    for (const device of devices[runtime] ?? []) {
      if (device.isAvailable === false) continue;
      out.push({
        name: device.name,
        udid: device.udid,
        runtime,
        state: device.state,
      });
    }
  }
  return out;
}

function pickSimulator(simulators, name) {
  const exact = simulators.filter((d) => d.name === name);
  if (exact.length > 0) {
    const booted = exact.find((d) => d.state === "Booted");
    return booted ?? exact[0];
  }
  const loose = simulators.filter((d) => d.name.includes(name));
  if (loose.length > 0) return loose[0];
  const iphone = simulators.find((d) => d.name.startsWith("iPhone"));
  return iphone ?? null;
}

function uninstallStaleBundleIds(udid) {
  for (const bundleId of ["org.name.GetPraying", "com.getpraying.app"]) {
    try {
      execSync(`xcrun simctl uninstall ${udid} ${bundleId}`, {
        stdio: "ignore",
      });
      // eslint-disable-next-line no-console
      console.log(`[run-ios-simulator] Uninstalled ${bundleId} (if present)`);
    } catch {
      // not installed
    }
  }
}

const simulators = listSimulators();
const target = pickSimulator(simulators, preferredName);
if (!target) {
  console.error(
    "[run-ios-simulator] No simulator found. Install an iOS runtime in Xcode → Settings → Platforms.",
  );
  console.error("Available:", simulators.map((d) => d.name).join(", ") || "(none)");
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `[run-ios-simulator] Using ${target.name} (${target.udid}) — not a physical device`,
);

uninstallStaleBundleIds(target.udid);

try {
  execSync(`xcrun simctl boot ${target.udid}`, { stdio: "ignore" });
} catch {
  // already booted
}

const result = spawnSync(
  "npx",
  ["expo", "run:ios", "--device", target.udid],
  {
    cwd: mobileRoot,
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
