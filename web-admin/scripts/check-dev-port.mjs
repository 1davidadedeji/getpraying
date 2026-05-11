#!/usr/bin/env node
/**
 * Prevent starting a second Next dev server (or any listener) on the same port.
 * Wrong process on :3100 commonly yields HTML/200 for routes but 404 for /_next/static/*.
 */
import net from "node:net";

const PORT = Number(process.env.WEB_ADMIN_DEV_PORT ?? 3100);

if (process.env.SKIP_WEB_ADMIN_PORT_CHECK === "1") {
  process.exit(0);
}

const socket = net.connect({ port: PORT, host: "127.0.0.1" });

socket.once("connect", () => {
  socket.end();
  console.error(
    [
      "",
      `\x1b[33m[web-admin]\x1b[0m Port ${PORT} is already in use on 127.0.0.1.`,
      "Another dev server or app may be bound there — often this causes 404s for /_next/static/chunks/*.",
      "",
      "Fix:",
      `  • Stop the other process:  lsof -nP -iTCP:${PORT} | grep LISTEN`,
      "  • Or use a clean restart:    pnpm --filter @workspace/web-admin run dev:fresh",
      "",
    ].join("\n"),
  );
  process.exit(1);
});

socket.once("error", (err) => {
  if (/** @type {NodeJS.ErrnoException} */ (err).code === "ECONNREFUSED") {
    process.exit(0);
  }
  process.exit(0);
});
