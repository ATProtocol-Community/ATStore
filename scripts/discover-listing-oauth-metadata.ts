#!/usr/bin/env node
/**
 * Walk `store_listings` and record a canonical OAuth `client_metadata` URL (or classify
 * app-password / mobile-only auth) in `store_listing_oauth_discovery`.
 *
 * 1. **`probeOAuthListingAuth`** — same well-known + static-path guesses as
 *    `scripts/sync-listing-oauth-probes.ts` (RFC 9728 / 8414 + client-metadata paths).
 * 2. **Playwright (headed by default)** — scan for login links, read page copy for
 *    OAuth vs app-password hints, follow a few entrypoints, optionally submit
 *    Bluesky-style identifier forms using env credentials, capture JSON URLs from
 *    network responses.
 * 3. **Manual** (TTY only) — you steer the browser, then choose:
 *    `[1]` native/mobile only (unsupported)
 *    `[2]` on the **PDS login page** — reads the **first `<h3>`** for an `https` URL, tests it as
 *        client-metadata, then falls back to query-param / well-known discovery (verbose logs)
 *    `[3]` mark as app-password web login
 *    `[s]` skip without writing
 *
 * Env:
 *   DATABASE_URL                        (required)
 *   LISTING_OAUTH_DISCOVERY_HANDLE      optional; e.g. `handle.atstory.fyi`
 *   LISTING_OAUTH_DISCOVERY_PASSWORD    optional; app password / password for test account
 *
 * CLI:
 *   --dry-run
 *   --force                             redo even if discovery already complete
 *   --slug=<slug>                       single listing
 *   --limit=N
 *   --headless                          run Playwright without a visible window
 *   --no-playwright                     only HTTP well-known/static probes (no browser; no manual)
 *   --progress-file=<path>              read/write per-slug progress (default: ./oauth-discovery-progress.json, or `OAUTH_DISCOVERY_PROGRESS_FILE`). Only `manual_skip` and `no_tty` entries are auto-excluded on the next run unless `--force`.
 *   --no-progress-file                  disable local progress file
 *
 * Listings in a **Protocol** directory category (`protocol/…` two-segment slug in
 * `category_slugs`) are skipped — they have no HTTP app `external_url` to OAuth-probe.
 *
 * If that misses a listing, re-run without `--no-playwright` for Playwright + optional manual steps.
 */
import "dotenv/config";

import type { Database } from "#/db/index.server";
import type { AuthorizationPageProbeAttempt } from "#/lib/oauth-authorization-page-discovery";
import type { StoreListingOauthDiscoveryDetail } from "#/lib/oauth-listing-oauth-discovery.types";

import * as schema from "#/db/schema";
import {
  oauthAuthorizationPageProbeTargets,
  probeOAuthClientMetadataFromAuthorizationServerPage,
} from "#/lib/oauth-authorization-page-discovery";
import {
  probeOAuthListingAuth,
  tryResolveOAuthClientMetadataUrlFast,
} from "#/lib/oauth-listing-auth-probe";
import {
  attachClientMetadataCapture,
  collectLoginLinkCandidates,
  exploreLoginEntrypoints,
  extractHttpUrlFromFirstH3,
  readAuthHintsFromBody,
  tryBlueskyishIdentifierLogin,
} from "#/lib/oauth-listing-playwright-discovery";
import { sqlCategorySlugsHasProtocolBrowseableSegment } from "#/lib/product-claim-eligibility";
import { and, asc, eq, isNotNull, not, sql } from "drizzle-orm";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

import type { SkippedListingReason } from "./oauth-discovery-local-progress";

import {
  defaultOAuthDiscoveryProgressPath,
  isSlugInLocalSkips,
  loadLocalProgress,
  recordSkippedListing,
} from "./oauth-discovery-local-progress";

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string, extra?: Record<string, unknown>) {
  const line = `[discover-listing-oauth-metadata] ${ts()} ${msg}`;
  if (extra && Object.keys(extra).length > 0) console.log(line, extra);
  else console.log(line);
}

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readOptionalPositiveInt(
  flag: string,
  envKey: string,
): number | undefined {
  const raw = parseFlag(flag) ?? process.env[envKey];
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

type ListingRow = { id: string; slug: string; externalUrl: string };

type DiscoveryRow = typeof schema.storeListingOauthDiscovery.$inferSelect;

function isDoneDiscovery(r: DiscoveryRow | undefined): boolean {
  if (!r) return false;
  if (r.clientMetadataUrl?.trim()) return true;
  if (r.authMethod === "app_password") return true;
  if (r.authMethod === "unsupported_mobile") return true;
  return false;
}

async function saveLocalSkip(args: {
  progressFile: string | null;
  listing: ListingRow;
  reason: SkippedListingReason;
  note?: string;
}) {
  if (!args.progressFile) return;
  await recordSkippedListing(args.progressFile, {
    storeListingId: args.listing.id,
    slug: args.listing.slug,
    skippedAt: new Date().toISOString(),
    reason: args.reason,
    ...(args.note === undefined ? {} : { note: args.note }),
  });
  log("local_progress_saved_skip", {
    slug: args.listing.slug,
    reason: args.reason,
    file: args.progressFile,
  });
}

async function upsertDiscovery(opts: {
  db: Database;
  listing: ListingRow;
  clientMetadataUrl: string | null;
  authMethod: string;
  resolution: string;
  loginPageUrl: string | null;
  detailJson: StoreListingOauthDiscoveryDetail;
  dryRun: boolean;
}) {
  const now = new Date();
  const row = {
    storeListingId: opts.listing.id,
    slug: opts.listing.slug,
    clientMetadataUrl: opts.clientMetadataUrl,
    authMethod: opts.authMethod,
    resolution: opts.resolution,
    loginPageUrl: opts.loginPageUrl,
    detailJson: opts.detailJson,
    updatedAt: now,
  };

  if (opts.dryRun) {
    log("dry_run_upsert_discovery", row);
    return;
  }

  await opts.db
    .insert(schema.storeListingOauthDiscovery)
    .values({
      ...row,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: schema.storeListingOauthDiscovery.storeListingId,
      set: {
        slug: row.slug,
        clientMetadataUrl: row.clientMetadataUrl,
        authMethod: row.authMethod,
        resolution: row.resolution,
        loginPageUrl: row.loginPageUrl,
        detailJson: row.detailJson,
        updatedAt: now,
      },
    });
}

async function runWellKnown(args: {
  db: Database;
  listing: ListingRow;
  dryRun: boolean;
}): Promise<{
  ok: boolean;
  clientUrl: string | null;
  detail: StoreListingOauthDiscoveryDetail;
}> {
  const report = await probeOAuthListingAuth(args.listing.externalUrl);
  const winner = report.clientMetadata.find((c) => c.result.ok);
  const clientUrl = winner?.url ?? null;
  const detail: StoreListingOauthDiscoveryDetail = {
    wellKnown: {
      inputUrl: report.inputUrl,
      clientMetadataAttempts: report.clientMetadata.map((c) => ({
        url: c.url,
        ok: c.result.ok,
        error: c.result.ok ? undefined : c.result.error,
      })),
    },
  };

  if (clientUrl) {
    await upsertDiscovery({
      db: args.db,
      listing: args.listing,
      clientMetadataUrl: clientUrl,
      authMethod: "oauth",
      resolution: "well_known",
      loginPageUrl: null,
      detailJson: detail,
      dryRun: args.dryRun,
    });
    return { ok: true, clientUrl, detail };
  }

  return { ok: false, clientUrl: null, detail };
}

/**
 * Headed browser stays open for manual triage; single page.
 */
async function runPlaywrightWithManual(args: {
  db: Database;
  listing: ListingRow;
  headless: boolean;
  handle: string | undefined;
  password: string | undefined;
  detailPrefix: StoreListingOauthDiscoveryDetail;
  dryRun: boolean;
  progressFile: string | null;
}): Promise<void> {
  const { chromium } = await import(/* @vite-ignore */ "playwright");
  const browser = await chromium.launch({ headless: args.headless });

  const captured = new Set<string>();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const detach = attachClientMetadataCapture(page, captured);

  let loginCandidates: Array<{ href: string; text: string }> = [];
  let classification = {
    appPasswordMentioned: false,
    oauthMentioned: false,
  };
  let visitedUrls: Array<string> = [];
  let loginAttempted = false;

  try {
    const start = args.listing.externalUrl.trim();
    await page.goto(start, {
      waitUntil: "domcontentloaded",
      timeout: 35_000,
    });
    await page.waitForTimeout(1200);
    loginCandidates = await collectLoginLinkCandidates(page);
    classification = await readAuthHintsFromBody(page);
    ({ visitedUrls } = await exploreLoginEntrypoints(page));

    if (args.handle?.trim() && args.password && classification.oauthMentioned) {
      loginAttempted = await tryBlueskyishIdentifierLogin(
        page,
        args.handle.trim(),
        args.password,
      );
      await page.waitForTimeout(2500);
    }

    const sortedCapture = [...captured].toSorted((a, b) => a.localeCompare(b));
    const firstCaptured = sortedCapture[0] ?? null;
    if (firstCaptured) {
      await upsertDiscovery({
        db: args.db,
        listing: args.listing,
        clientMetadataUrl: firstCaptured,
        authMethod: "oauth",
        resolution: "playwright",
        loginPageUrl: page.url(),
        detailJson: {
          ...args.detailPrefix,
          playwright: {
            startUrl: start,
            loginCandidates,
            visitedUrls,
            capturedClientMetadataUrls: [...captured],
            classification,
            attemptedAutomatedLogin: loginAttempted,
          },
        },
        dryRun: args.dryRun,
      });
      return;
    }

    if (classification.appPasswordMentioned && !classification.oauthMentioned) {
      await upsertDiscovery({
        db: args.db,
        listing: args.listing,
        clientMetadataUrl: null,
        authMethod: "app_password",
        resolution: "playwright",
        loginPageUrl: page.url(),
        detailJson: {
          ...args.detailPrefix,
          playwright: {
            startUrl: start,
            loginCandidates,
            visitedUrls,
            capturedClientMetadataUrls: [...captured],
            classification,
            attemptedAutomatedLogin: loginAttempted,
          },
        },
        dryRun: args.dryRun,
      });
      return;
    }

    if (!input.isTTY) {
      log("manual_needed_no_tty", {
        slug: args.listing.slug,
        hint: "Re-run in an interactive terminal for manual steps.",
      });
      await saveLocalSkip({
        progressFile: args.progressFile,
        listing: args.listing,
        reason: "no_tty",
      });
      return;
    }

    const rl = readline.createInterface({ input, output });
    try {
      output.write(
        "\n--- Manual triage ---\n" +
          `Listing: ${args.listing.slug}\n` +
          "The browser window should still be open. For [2], navigate to the PDS / OAuth server login URL (authorization page).\n" +
          "  [1] Mobile / native app only — we cannot automate (unsupported)\n" +
          "  [2] I am on the PDS / server OAuth login page — resolve client-metadata from this URL\n" +
          "  [3] I am on the web login — it uses app password (not OAuth)\n" +
          "  [s] Skip (do not save)\n" +
          "Choice: ",
      );
      const choiceRaw = await rl.question("");
      const choice = choiceRaw.trim().toLowerCase();

      const pageUrl = page.url();
      const baseDetail: StoreListingOauthDiscoveryDetail = {
        ...args.detailPrefix,
        playwright: {
          startUrl: start,
          loginCandidates,
          visitedUrls,
          capturedClientMetadataUrls: [...captured],
          classification,
          attemptedAutomatedLogin: loginAttempted,
        },
      };

      if (choice === "1") {
        await upsertDiscovery({
          db: args.db,
          listing: args.listing,
          clientMetadataUrl: null,
          authMethod: "unsupported_mobile",
          resolution: "manual_mobile",
          loginPageUrl: pageUrl,
          detailJson: {
            ...baseDetail,
            manual: {
              choice: "mobile_unsupported",
              pageUrlWhenResolved: pageUrl,
            },
          },
          dryRun: args.dryRun,
        });
      } else if (choice === "2") {
        log("manual_option2_start", { slug: args.listing.slug });
        console.log("");
        console.log(
          `[${args.listing.slug}] Option 2 — PDS / OAuth page: open the right tab in the browser,`,
        );
        console.log(
          `then press Enter HERE (terminal). We will read the first <h3> for an https URL and test it.\n`,
        );
        await rl.question(
          `[${args.listing.slug}] Press Enter when the tab is ready… `,
        );

        const u = page.url();
        log("manual_option2_tab_url", { slug: args.listing.slug, url: u });

        const h3 = await extractHttpUrlFromFirstH3(page);
        log("manual_option2_first_h3", {
          slug: args.listing.slug,
          rawText:
            h3.rawText.length > 800
              ? `${h3.rawText.slice(0, 800)}…`
              : h3.rawText,
          extractedUrl: h3.url,
        });
        if (!h3.rawText) {
          console.warn(
            `[${args.listing.slug}] No <h3> text found on the page — try query-param fallback below.\n`,
          );
        } else if (!h3.url) {
          console.warn(
            `[${args.listing.slug}] No https URL inside first <h3> — falling back to address bar URL / query params.\n`,
          );
        }

        const onProg = (event: string, data?: Record<string, unknown>) =>
          log(event, { slug: args.listing.slug, ...data });

        const attempts: Array<AuthorizationPageProbeAttempt> = [];
        let metaUrl: string | null = null;

        if (h3.url) {
          log("manual_option2_resolving_h3_url", {
            slug: args.listing.slug,
            target: h3.url,
          });
          try {
            const found = await tryResolveOAuthClientMetadataUrlFast(
              h3.url,
              onProg,
            );
            attempts.push({
              target: `first_h3:${h3.url}`,
              clientMetadataFoundUrl: found?.url ?? null,
            });
            if (found?.url) {
              metaUrl = found.url;
            }
          } catch (error) {
            const err = error instanceof Error ? error.message : String(error);
            attempts.push({
              target: `first_h3:${h3.url}`,
              clientMetadataFoundUrl: null,
              error: err,
            });
            log("manual_option2_h3_resolve_error", {
              slug: args.listing.slug,
              error: err,
            });
          }
        }

        if (!metaUrl) {
          log("manual_option2_fallback_address_and_query_params", {
            slug: args.listing.slug,
            pageUrl: u,
          });
          const pds = await probeOAuthClientMetadataFromAuthorizationServerPage(
            u,
            onProg,
          );
          attempts.push(...pds.attempts);
          metaUrl = pds.clientMetadataUrl;
        }

        const sortedCap = [...captured].toSorted((a, b) => a.localeCompare(b));
        if (!metaUrl && sortedCap[0]) {
          metaUrl = sortedCap[0] ?? null;
          log("manual_option2_using_captured_network_url", {
            slug: args.listing.slug,
            metaUrl,
          });
        }

        log("manual_option2_final", {
          slug: args.listing.slug,
          clientMetadataUrl: metaUrl,
          attempts: attempts.length,
        });

        await upsertDiscovery({
          db: args.db,
          listing: args.listing,
          clientMetadataUrl: metaUrl,
          authMethod: metaUrl ? "oauth" : "unknown",
          resolution: "manual_oauth",
          loginPageUrl: u,
          detailJson: {
            ...args.detailPrefix,
            playwright: {
              startUrl: start,
              loginCandidates,
              visitedUrls,
              capturedClientMetadataUrls: sortedCap,
              classification,
              attemptedAutomatedLogin: loginAttempted,
            },
            manual: {
              choice: "pds_server_oauth_login",
              pageUrlWhenResolved: u,
              authorizationPageProbe: {
                hintTargets: oauthAuthorizationPageProbeTargets(u),
                firstH3: {
                  rawText: h3.rawText,
                  extractedUrl: h3.url,
                },
                attempts,
              },
            },
          },
          dryRun: args.dryRun,
        });
      } else if (choice === "3") {
        await upsertDiscovery({
          db: args.db,
          listing: args.listing,
          clientMetadataUrl: null,
          authMethod: "app_password",
          resolution: "manual_app_password",
          loginPageUrl: pageUrl,
          detailJson: {
            ...baseDetail,
            manual: {
              choice: "app_password_confirmed",
              pageUrlWhenResolved: pageUrl,
            },
          },
          dryRun: args.dryRun,
        });
      } else {
        log("manual_skipped", { slug: args.listing.slug });
        await saveLocalSkip({
          progressFile: args.progressFile,
          listing: args.listing,
          reason: "manual_skip",
        });
      }
    } finally {
      await rl.close();
    }
  } finally {
    detach();
    await browser.close();
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const headless = hasFlag("headless");
  const noPlaywright = hasFlag("no-playwright");
  const slugFilter = parseFlag("slug")?.trim();
  const limit = readOptionalPositiveInt(
    "limit",
    "LISTING_OAUTH_DISCOVERY_LIMIT",
  );

  const handle = process.env.LISTING_OAUTH_DISCOVERY_HANDLE?.trim();
  const password = process.env.LISTING_OAUTH_DISCOVERY_PASSWORD?.trim();

  const noProgressFile = hasFlag("no-progress-file");
  const progressFile = noProgressFile
    ? null
    : parseFlag("progress-file")?.trim() || defaultOAuthDiscoveryProgressPath();
  const localProgress = progressFile
    ? await loadLocalProgress(progressFile)
    : null;

  const { db, dbClient } = await import("#/db/index.server");

  const existing = await db.select().from(schema.storeListingOauthDiscovery);
  const doneMap = new Map(existing.map((r) => [r.storeListingId, r]));

  const conditions = [
    isNotNull(schema.storeListings.externalUrl),
    not(
      sqlCategorySlugsHasProtocolBrowseableSegment(
        schema.storeListings.categorySlugs,
      ),
    ),
    // Non-HTTP external URLs (e.g. at://) cannot be probed like HTTPS storefronts.
    sql`lower(trim(${schema.storeListings.externalUrl})) not like 'at:%'`,
  ];
  if (slugFilter) {
    conditions.push(eq(schema.storeListings.slug, slugFilter));
  }

  const baseQuery = db
    .select({
      id: schema.storeListings.id,
      slug: schema.storeListings.slug,
      externalUrl: schema.storeListings.externalUrl,
    })
    .from(schema.storeListings)
    .where(and(...conditions))
    .orderBy(asc(schema.storeListings.slug));

  const rows =
    limit === undefined ? await baseQuery : await baseQuery.limit(limit);
  let listings: Array<ListingRow> = rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      externalUrl: r.externalUrl?.trim() ?? "",
    }))
    .filter((r) => r.externalUrl.length > 0);

  if (localProgress && !force) {
    const before = listings.length;
    listings = listings.filter(
      (l) => !isSlugInLocalSkips(localProgress, l.slug),
    );
    if (before !== listings.length) {
      log("startup_filtered_local_skips", {
        removed: before - listings.length,
        file: progressFile,
      });
    }
  }

  log("startup", {
    candidates: listings.length,
    dryRun,
    force,
    headless,
    noPlaywright,
    slugFilter: slugFilter ?? null,
    limit: limit ?? null,
    hasDiscoveryCredentials: Boolean(handle && password),
    progressFile: progressFile ?? null,
  });

  for (const listing of listings) {
    const prev = doneMap.get(listing.id);
    if (!force && isDoneDiscovery(prev)) {
      log("skip_already_resolved", { slug: listing.slug });
      continue;
    }

    log("listing_start", { slug: listing.slug, url: listing.externalUrl });

    let well: Awaited<ReturnType<typeof runWellKnown>>;
    try {
      well = await runWellKnown({ db, listing, dryRun });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("well_known_error", {
        slug: listing.slug,
        error: message,
      });
      await saveLocalSkip({
        progressFile,
        listing,
        reason: "well_known_error",
        note: message,
      });
      continue;
    }

    if (well.ok) {
      log("resolved_well_known", {
        slug: listing.slug,
        clientUrl: well.clientUrl,
      });
      continue;
    }

    if (noPlaywright) {
      log("well_known_miss_no_browser", {
        slug: listing.slug,
        hint: "Re-run without --no-playwright to use Playwright + manual triage.",
      });
      await saveLocalSkip({
        progressFile,
        listing,
        reason: "well_known_miss_no_browser",
      });
      continue;
    }

    if (dryRun) {
      log("dry_run_skip_playwright", { slug: listing.slug });
      continue;
    }

    try {
      await runPlaywrightWithManual({
        db,
        listing,
        headless,
        handle,
        password,
        detailPrefix: well.detail,
        dryRun,
        progressFile,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("playwright_error", {
        slug: listing.slug,
        error: message,
      });
      await saveLocalSkip({
        progressFile,
        listing,
        reason: "playwright_error",
        note: message,
      });
    }
  }

  await dbClient.end({ timeout: 5 }).catch(() => {});
  log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
