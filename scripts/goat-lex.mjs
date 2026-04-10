#!/usr/bin/env node
/**
 * Runs the `goat` CLI with `.env` loaded and ATSTORE_* mapped to GOAT_* (same pattern as Kitchen).
 * Install: https://github.com/bluesky-social/goat (e.g. `brew install goat`)
 */
import "dotenv/config";
import { spawn } from "node:child_process";

if (!process.env.GOAT_USERNAME && process.env.ATSTORE_IDENTIFIER) {
  process.env.GOAT_USERNAME = process.env.ATSTORE_IDENTIFIER;
}
if (!process.env.GOAT_PASSWORD && process.env.ATSTORE_APP_PASSWORD) {
  process.env.GOAT_PASSWORD = process.env.ATSTORE_APP_PASSWORD;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "usage: node scripts/goat-lex.mjs <goat args…>  e.g. node scripts/goat-lex.mjs lex publish",
  );
  process.exit(1);
}

const child = spawn("goat", args, {
  stdio: "inherit",
  shell: false,
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
