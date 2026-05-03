#!/usr/bin/env node
/**
 * CLI wrapper around `#/lib/oauth-listing-auth-probe`.
 *
 *   pnpm exec tsx scripts/detect-listing-oauth-scopes.ts <url> [--json]
 *
 * Cron / DB batch path: use `pnpm listing:oauth-probes-sync` instead.
 */
import type { OAuthAuthProbeReport } from "#/lib/oauth-listing-auth-probe";

import { probeOAuthListingAuth } from "#/lib/oauth-listing-auth-probe";
import process from "node:process";

function parseArgs(argv: Array<string>): { url: string; json: boolean } {
  const rest = argv.slice(2).filter((a) => a !== "");
  let json = false;
  const positional: Array<string> = [];
  for (const a of rest) {
    if (a === "--json" || a === "-j") {
      json = true;
      continue;
    }
    positional.push(a);
  }
  const url = positional[0]?.trim() ?? "";
  return { url, json };
}

function printOAuthAuthProbeReport(
  report: OAuthAuthProbeReport,
  json: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Input: ${report.inputUrl}\n`);

  if (report.wwwAuthenticateHints.length > 0) {
    console.log(
      `Link / WWW-Authenticate hints:\n${report.wwwAuthenticateHints.map((x) => `  - ${x}`).join("\n")}\n`,
    );
  }

  if (report.protectedResource.raw) {
    const prUrl = report.protectedResource.attempted.find((a) => a.ok)?.url;
    console.log(
      `Protected Resource Metadata (${prUrl ?? "?"}):\n` +
        `  authorization_servers: ${JSON.stringify(report.protectedResource.authorizationServers)}\n` +
        `  scopes_supported (if any): ${JSON.stringify(report.protectedResource.mergedScopes)}\n`,
    );
  } else {
    console.log("Protected Resource Metadata: (not found)\n");
    for (const att of report.protectedResource.attempted) {
      if (att.ok) continue;
      console.log(`  tried ${att.url}: ${att.status ?? "?"} ${att.error}`);
    }
    console.log();
  }

  if (report.authorizationServersDetail.length > 0) {
    console.log("Authorization Server metadata:");
    for (const row of report.authorizationServersDetail) {
      const mark = row.result.ok ? "ok" : "fail";
      const msg = row.result.ok
        ? ""
        : `${String(row.result.status ?? "")} ${row.result.error}`.trim();
      console.log(
        `  [${mark}] ${row.metadataUrl}` +
          (msg ? `: ${msg}` : "") +
          `\n          scopes_supported: ${JSON.stringify(row.scopes_supported ?? [])}`,
      );
    }
    console.log();
  }

  if (report.clientMetadata.some((x) => x.result.ok)) {
    console.log("Client metadata:");
    for (const c of report.clientMetadata.filter((x) => x.result.ok)) {
      console.log(
        `  ${c.url}\n    scope hint: ${c.scope_field ?? "(none / see document)"}`,
      );
    }
    console.log();
  }

  console.log("Summary:");
  console.log(
    `  Distinct scopes: ${report.summary.oauthScopesDistinct.join(", ") || "(none)"}`,
  );
  console.log(
    `  Client-metadata-only distinct: ${(report.summary.oauthClientScopesDistinct ?? []).join(", ") || "(none)"}`,
  );
  console.log(
    `  Transitional scopes: ${report.summary.transitionalScopesPresent.join(", ") || "(none)"}`,
  );
  console.log(
    `  AS lists atproto scope: ${String(report.summary.publishesAtprotoAs)}`,
  );
  console.log(
    `  OAuth scope syntax (whole client line via @atcute/oauth-types isOAuthScope): ${report.summary.clientScopeSyntaxOk === null ? "n/a" : String(report.summary.clientScopeSyntaxOk)}`,
  );
  if (report.summary.scopeHumanReadable.length > 0) {
    console.log("  Expanded scopes:");
    for (const row of report.summary.scopeHumanReadable) {
      console.log(`    - ${row.token}`);
      console.log(`      ${row.description}`);
      if ("includePermissionSet" in row) {
        const ps = row.includePermissionSet;
        console.log(
          `      bundle (${ps.sourceKind}): ${ps.title ?? "(untitled bundle)"}`,
        );
        if (ps.detail) {
          console.log(`      bundle detail: ${ps.detail}`);
        }
        console.log(`      lexicon JSON: ${ps.sourceUrl}`);
        for (const line of ps.structuredLines) {
          console.log(`        · ${line}`);
        }
      }
      if ("includePermissionSetUnresolved" in row) {
        const u = row.includePermissionSetUnresolved;
        console.log(`      could not load permission-set lexicon: ${u.reason}`);
        if (u.attemptedRemoteUrls.length > 0) {
          console.log("      URLs attempted:");
          for (const ru of u.attemptedRemoteUrls) {
            console.log(`        - ${ru}`);
          }
        }
      }
    }
  }
  console.log();
  console.log(report.notes.map((n) => `Note: ${n}`).join("\n"));
}

async function main(): Promise<void> {
  const { url: rawArg, json: jsonFlag } = parseArgs(process.argv);
  if (!rawArg) {
    console.error(
      "Usage: pnpm exec tsx scripts/detect-listing-oauth-scopes.ts <url> [--json]\n\n" +
        "Example URLs:\n" +
        "  https://<pds-host>/\n" +
        "  https://<listing-external-url>/\n\n" +
        "Batch + DB persistence: `pnpm listing:oauth-probes-sync`\n",
    );
    process.exitCode = 1;
    return;
  }

  let report: OAuthAuthProbeReport;
  try {
    report = await probeOAuthListingAuth(rawArg);
  } catch (error) {
    console.error(
      `Probe failed (${rawArg}):`,
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
    return;
  }

  printOAuthAuthProbeReport(report, jsonFlag);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
