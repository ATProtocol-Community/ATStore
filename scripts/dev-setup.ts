/**
 * One-shot bootstrap for local development.
 *
 *   pnpm setup
 *
 * What it does:
 *   1. Copies .env.example -> .env if .env is missing.
 *   2. Connects to DATABASE_URL.
 *   3. Ensures the `vector` (pgvector) extension is installed.
 *   4. Runs Drizzle migrations.
 *   5. Seeds the database with a handful of demo listings.
 *
 * Safe to run repeatedly. Idempotent.
 */
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const ENV_PATH = join(repoRoot, ".env");
const ENV_EXAMPLE_PATH = join(repoRoot, ".env.example");

const STEP = (n: number, msg: string) =>
  console.log(`\n\u001B[1;36m[${n}/5]\u001B[0m ${msg}`);
const OK = (msg: string) => console.log(`  \u001B[32m✓\u001B[0m ${msg}`);
const INFO = (msg: string) => console.log(`  \u001B[2m${msg}\u001B[0m`);
const FAIL = (msg: string) => console.log(`  \u001B[31m✗\u001B[0m ${msg}`);

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureEnvFile() {
  STEP(1, "Ensure .env exists");
  if (await fileExists(ENV_PATH)) {
    OK(".env already present (leaving as-is)");
    return;
  }
  if (!(await fileExists(ENV_EXAMPLE_PATH))) {
    throw new Error(".env.example is missing — cannot bootstrap .env");
  }
  await copyFile(ENV_EXAMPLE_PATH, ENV_PATH);
  OK(".env created from .env.example");
  INFO("Edit .env to fill in optional API keys (Anthropic, Gemini, ATProto…).");
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url;
  }
}

function loadEnv() {
  // Load .env now that it definitely exists.
  // Using dynamic import so this works regardless of NODE_OPTIONS.
  return import("dotenv").then((m) =>
    m.config({ path: ENV_PATH, override: false }),
  );
}

async function checkDatabaseConnection() {
  STEP(2, "Connect to Postgres");
  await loadEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    FAIL("DATABASE_URL is not set in .env");
    printPostgresHelp();
    throw new Error("DATABASE_URL missing");
  }

  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 1 });
  try {
    const [{ version }] = await sql<
      Array<{ version: string }>
    >`select version()`;
    OK(`Connected to ${maskUrl(url)}`);
    INFO(version.split(" ").slice(0, 2).join(" "));
    return sql;
  } catch (error) {
    FAIL(`Could not connect to ${maskUrl(url)}`);
    INFO(error instanceof Error ? error.message : String(error));
    await sql.end({ timeout: 1 }).catch(() => {});
    printPostgresHelp();
    throw new Error("Postgres is not reachable");
  }
}

async function ensurePgvector(sql: ReturnType<typeof postgres>) {
  STEP(3, "Install pgvector extension");
  // Check whether the extension is at least *available* (installed on disk).
  const available = await sql<
    Array<{ name: string }>
  >`select name from pg_available_extensions where name = 'vector'`;
  if (available.length === 0) {
    FAIL("Extension 'vector' is not available on this Postgres server");
    printPgvectorHelp();
    throw new Error("pgvector not installed on Postgres server");
  }
  await sql`create extension if not exists vector`;
  OK("pgvector is installed and enabled");
}

function runStreaming(cmd: string, args: Array<string>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: repoRoot, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function runMigrations() {
  STEP(4, "Run Drizzle migrations");
  await runStreaming("pnpm", ["db:migrate"]);
  OK("Migrations applied");
}

async function runSeed() {
  STEP(5, "Seed demo listings");
  await runStreaming("pnpm", ["db:seed"]);
  OK("Seed complete");
}

function printPostgresHelp() {
  console.log(`
  \u001B[1mNeed Postgres?\u001B[0m
    macOS (Homebrew):   brew install postgresql@17 pgvector && brew services start postgresql@17
    Linux (Debian/Ubu): sudo apt install postgresql-17 postgresql-17-pgvector
    Or use Postgres.app: https://postgresapp.com (then install pgvector with \`brew install pgvector\`)

  Then create the database and set DATABASE_URL in .env:
    createdb at_store
    DATABASE_URL=postgresql://$USER@localhost:5432/at_store
`);
}

function printPgvectorHelp() {
  console.log(`
  \u001B[1mInstall pgvector\u001B[0m
    macOS (Homebrew):   brew install pgvector && brew services restart postgresql@17
    Linux (Debian/Ubu): sudo apt install postgresql-17-pgvector
    From source:        https://github.com/pgvector/pgvector#installation
`);
}

async function main() {
  console.log("\u001B[1mat.store local dev setup\u001B[0m");
  await ensureEnvFile();
  const sql = await checkDatabaseConnection();
  try {
    await ensurePgvector(sql);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
  await runMigrations();
  await runSeed();
  console.log(
    "\n\u001B[1;32m✓ Setup complete.\u001B[0m  Next: \u001B[1mpnpm dev\u001B[0m",
  );
}

main().catch((error) => {
  console.error(
    "\n\u001B[31m✗ Setup failed:\u001B[0m",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
