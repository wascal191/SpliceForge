#!/usr/bin/env node
/**
 * Cross-platform `db:init` runner.
 *
 * Loads .env.local (and falls back to the process env), then spawns `psql`
 * with the DATABASE_URL connection string and applies db/schema.sql.
 *
 * On Windows, `psql` may not be on PATH after a default Postgres install. If
 * it isn't found, set the `PSQL` env var to the full path, e.g.:
 *   $env:PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
 *   npm run db:init
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip optional surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "db:init — DATABASE_URL is not set. Add it to .env.local, e.g.\n" +
      "  DATABASE_URL=postgres://postgres:postgres@localhost:5432/spliceforge"
  );
  process.exit(1);
}

const schemaPath = resolve(root, "db", "schema.sql");
if (!existsSync(schemaPath)) {
  console.error(`db:init — schema file not found: ${schemaPath}`);
  process.exit(1);
}

const psql = process.env.PSQL || "psql";
const args = [url, "-v", "ON_ERROR_STOP=1", "-f", schemaPath];

console.log(`db:init — running ${psql} against ${redact(url)}`);
const child = spawn(psql, args, { stdio: "inherit", shell: false });

child.on("error", (err) => {
  if (err && err.code === "ENOENT") {
    console.error(
      `\ndb:init — could not find "${psql}".\n` +
        "Install PostgreSQL or set the PSQL env var to the full path, e.g.\n" +
        '  $env:PSQL = "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"\n' +
        "  npm run db:init"
    );
  } else {
    console.error("db:init — failed to spawn psql:", err);
  }
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 1));

function redact(connectionString) {
  return connectionString.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@");
}
