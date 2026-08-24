import { loadApiEnv } from "./lib/loadEnv";
loadApiEnv();

import app from "./app";
import { logger } from "./lib/logger";
import { expoPushAccessTokenConfigured } from "./lib/expoPushHttp";
import { startScheduledNotifications } from "./lib/scheduledNotifications";
import { startSimulatedActivityScheduler } from "./lib/simulatedActivityScheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env.HOST?.trim();

const onListen = (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, host: host || "default" }, "Server listening");
  if (!expoPushAccessTokenConfigured()) {
    logger.warn(
      "EXPO_ACCESS_TOKEN is not set — push requests are unauthenticated (lower priority, may be rate-limited). " +
        "Generate one at expo.dev/accounts/timelesz_dave/projects/get-praying → Access tokens, then set EXPO_ACCESS_TOKEN in .env.",
    );
  }
  startScheduledNotifications();
  startSimulatedActivityScheduler();
};

if (host) {
  app.listen(port, host, onListen);
} else {
  app.listen(port, onListen);
}
