#!/usr/bin/env node
import "dotenv/config";

import { spawn } from "node:child_process";

type Args = {
  dryRun: boolean;
  force: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dryRun: false,
    force: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--force") {
      out.force = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`
Usage: pnpm generate:missing-category-headers -- [options]

Runs all category header/banner generators with shared skip logic:
  1) app tag hero images
  2) ecosystem hero images
  3) protocol category cover images

Options:
      --dry-run       Print what would generate without calling Gemini
      --force         Regenerate even if assets already exist
  -h, --help          Show help
`);
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (typeof code === "number" && code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          signal
            ? `${command} ${args.join(" ")} exited due to signal ${signal}`
            : `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

function buildScriptArgs(args: Args) {
  const scriptArgs: string[] = [];

  if (args.dryRun) {
    scriptArgs.push("--dry-run");
  }
  if (args.force) {
    scriptArgs.push("--force");
  }

  return scriptArgs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const scriptArgs = buildScriptArgs(args);
  const runnerArgs = scriptArgs.length > 0 ? ["--", ...scriptArgs] : [];

  const tasks = [
    "generate:app-tag-hero-images",
    "generate:ecosystem-hero-images",
    "generate:protocol-category-covers",
  ] as const;

  for (const task of tasks) {
    console.log(`\n==> Running ${task}${scriptArgs.length ? ` (${scriptArgs.join(" ")})` : ""}`);
    await runCommand(pnpmCommand, ["run", task, ...runnerArgs]);
  }

  console.log("\nAll category header/banner generators completed.");
}

await main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
