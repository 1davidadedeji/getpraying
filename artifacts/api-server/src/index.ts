import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { expoPushAccessTokenConfigured } from "./lib/expoPushHttp";
import { startScheduledNotifications } from "./lib/scheduledNotifications";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (!expoPushAccessTokenConfigured()) {
    logger.warn(
      "EXPO_ACCESS_TOKEN is not set — Expo push will fail with InvalidCredentials. Create a token for @timelesz_dave/get-praying (project slug get-praying).",
    );
  }
  startScheduledNotifications();
});
