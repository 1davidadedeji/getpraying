#!/usr/bin/env node
/**
 * Apply SQL migrations from lib/db/drizzle/*.sql in numeric filename order.
 * Tracks applied files in schema_migrations. Safe to re-run (skips completed files).
 *
 * Usage (from repo root):
 *   pnpm db:migrate
 *
 * Requires DATABASE_URL in the environment or repo root .env
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, "../drizzle");
const REPO_ROOT_ENV = join(__dirname, "../../../.env");

function loadRootEnv() {
  if (process.env.DATABASE_URL) return;
  if (!existsSync(REPO_ROOT_ENV)) return;
  const text = readFileSync(REPO_ROOT_ENV, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === "DATABASE_URL" && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = val;
    }
  }
}

function sqlFiles() {
  return readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedSet(client) {
  const res = await client.query("SELECT filename FROM schema_migrations");
  return new Set(res.rows.map((r) => r.filename));
}

async function applyFile(client, filename) {
  const path = join(DRIZZLE_DIR, filename);
  const sql = readFileSync(path, "utf8");
  if (!sql.trim()) {
    console.warn(`[db:migrate] skip empty ${filename}`);
    return;
  }
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    console.info(`[db:migrate] applied ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function status(client) {
  await ensureMigrationsTable(client);
  const done = await appliedSet(client);
  const files = sqlFiles();
  console.info(`[db:migrate] ${done.size}/${files.length} applied`);
  for (const f of files) {
    console.info(`  ${done.has(f) ? "✓" : "·"} ${f}`);
  }
}

async function main() {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[db:migrate] DATABASE_URL is required (set in env or repo root .env)");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    if (process.argv.includes("--status")) {
      await status(client);
      return;
    }

    await ensureMigrationsTable(client);
    const done = await appliedSet(client);
    const pending = sqlFiles().filter((f) => !done.has(f));

    if (pending.length === 0) {
      console.info("[db:migrate] database is up to date");
      return;
    }

    for (const file of pending) {
      await applyFile(client, file);
    }
    console.info(`[db:migrate] done (${pending.length} migration(s) applied)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db:migrate] failed:", err?.message ?? err);
  process.exit(1);
});
