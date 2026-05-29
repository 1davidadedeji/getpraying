#!/usr/bin/env node
/**
 * Apply SQL migrations from lib/db/drizzle/*.sql in numeric filename order.
 * Tracks applied files in schema_migrations. Safe to re-run (skips completed files).
 *
 * Usage (from repo root):
 *   pnpm db:migrate              # apply pending migrations
 *   pnpm db:migrate:status       # list applied / pending
 *   pnpm db:migrate:baseline     # mark all migrations applied without running SQL
 *
 * Existing databases (created before schema_migrations): on "already exists" errors
 * the migration is recorded as baselined and the runner continues. Use --strict to
 * fail instead.
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

/** Postgres codes / messages that mean this migration was already applied manually. */
const ALREADY_APPLIED_CODES = new Set(["42P07", "42701", "42710", "42P06"]);

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

function parseArgs(argv) {
  let baselineBefore = null;
  for (const arg of argv) {
    if (arg.startsWith("--baseline-before=")) {
      baselineBefore = arg.slice("--baseline-before=".length);
    }
  }
  return {
    status: argv.includes("--status"),
    baseline: argv.includes("--baseline"),
    baselineBefore,
    strict: argv.includes("--strict"),
  };
}

function isAlreadyAppliedError(err) {
  if (err && ALREADY_APPLIED_CODES.has(err.code)) return true;
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate column") ||
    msg.includes("duplicate table")
  );
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

async function recordMigration(client, filename) {
  await client.query(
    "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
    [filename],
  );
}

async function applyFile(client, filename) {
  const path = join(DRIZZLE_DIR, filename);
  const sql = readFileSync(path, "utf8");
  if (!sql.trim()) {
    console.warn(`[db:migrate] skip empty ${filename}`);
    await recordMigration(client, filename);
    return;
  }
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await recordMigration(client, filename);
    await client.query("COMMIT");
    console.info(`[db:migrate] applied ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function applyFileOrBaseline(client, filename, { strict }) {
  try {
    await applyFile(client, filename);
  } catch (err) {
    if (strict || !isAlreadyAppliedError(err)) throw err;
    await recordMigration(client, filename);
    console.info(
      `[db:migrate] baselined ${filename} (schema already present: ${err.message ?? err})`,
    );
  }
}

async function baselineFiles(client, files, { before = null, all = false } = {}) {
  await ensureMigrationsTable(client);
  const done = await appliedSet(client);
  let toMark = files;
  if (before) {
    const idx = files.indexOf(before);
    if (idx === -1) {
      throw new Error(`[db:migrate] unknown migration file for --baseline-before: ${before}`);
    }
    toMark = files.slice(0, idx);
  } else if (!all) {
    throw new Error("[db:migrate] use --baseline or --baseline-before=<file>");
  }
  let marked = 0;
  for (const f of toMark) {
    if (done.has(f)) continue;
    await recordMigration(client, f);
    marked++;
    console.info(`[db:migrate] baselined ${f}`);
  }
  console.info(`[db:migrate] baseline complete (${marked} file(s) recorded)`);
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

  const args = parseArgs(process.argv.slice(2));
  const files = sqlFiles();
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    if (args.status) {
      await status(client);
      return;
    }

    if (args.baseline || args.baselineBefore) {
      await baselineFiles(client, files, {
        before: args.baselineBefore,
        all: Boolean(args.baseline && !args.baselineBefore),
      });
      return;
    }

    await ensureMigrationsTable(client);
    const done = await appliedSet(client);
    const pending = files.filter((f) => !done.has(f));

    if (pending.length === 0) {
      console.info("[db:migrate] database is up to date");
      return;
    }

    const usersExists = await client
      .query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`,
      )
      .then((r) => r.rowCount > 0);

    if (usersExists && pending[0]?.startsWith("0000_")) {
      console.info(
        "[db:migrate] existing database detected — skipping migrations already present on schema",
      );
    }

    for (const file of pending) {
      await applyFileOrBaseline(client, file, { strict: args.strict });
    }
    console.info(`[db:migrate] done (${pending.length} migration(s) processed)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db:migrate] failed:", err?.message ?? err);
  process.exit(1);
});
