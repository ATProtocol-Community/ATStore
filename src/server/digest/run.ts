import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { buildDigest, isDigestEmpty } from "./builder";
import { sendEmail } from "./comail";
import {
  DIGEST_MIN_INTERVAL_DAYS,
  digestConfig,
  digestUnsubscribeUrl,
  getDigestBaseUrl,
} from "./config";
import { renderDigestEmail } from "./render";
import { makeUnsubscribeToken } from "./unsubscribe-token";

export interface DigestRunSummary {
  candidates: number;
  sent: number;
  failed: number;
  rateLimited: boolean;
  /** True when there were no new or trending apps, so nothing was sent. */
  skippedEmpty: boolean;
  dryRun: boolean;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runWeeklyDigest(
  db: Database,
  options: { dryRun?: boolean; log?: (msg: string) => void } = {},
): Promise<DigestRunSummary> {
  const log = options.log ?? console.info;
  const dryRun = options.dryRun === true;
  const baseUrl = getDigestBaseUrl();

  const candidates = await db.query.user.findMany({
    where: and(
      isNotNull(schema.user.email),
      isNotNull(schema.user.did),
      eq(schema.user.weeklyDigestEnabled, true),
      or(
        isNull(schema.user.weeklyDigestLastSentAt),
        lt(
          schema.user.weeklyDigestLastSentAt,
          sql`now() - (${DIGEST_MIN_INTERVAL_DAYS}::text || ' days')::interval`,
        ),
      ),
    ),
    columns: { id: true, email: true },
    limit: digestConfig.maxPerRun,
  });

  const summary: DigestRunSummary = {
    candidates: candidates.length,
    sent: 0,
    failed: 0,
    rateLimited: false,
    skippedEmpty: false,
    dryRun,
  };

  // Same content for everyone — build and render the body once.
  const digest = await buildDigest(db, { baseUrl });
  log(
    `[digest] ${digest.newApps.length} new, ${digest.trendingApps.length} trending, ${candidates.length} recipients`,
  );
  if (isDigestEmpty(digest)) {
    // Nobody is stamped, so next week's run picks everyone up again.
    summary.skippedEmpty = true;
    return summary;
  }

  for (const [i, recipient] of candidates.entries()) {
    if (!recipient.email) continue;

    const unsubscribeUrl = digestUnsubscribeUrl(
      baseUrl,
      makeUnsubscribeToken(recipient.id),
    );
    const rendered = await renderDigestEmail(digest, {
      baseUrl,
      unsubscribeUrl,
    });

    if (dryRun) {
      log(
        `[digest] dry run: would send "${rendered.subject}" to ${recipient.id}`,
      );
      summary.sent++;
      continue;
    }

    const result = await sendEmail({
      to: recipient.email,
      ...rendered,
      unsubscribeUrl,
    });

    if (result.rateLimited) {
      // Hourly ceiling hit — stop; unsent users keep their stale timestamp.
      summary.rateLimited = true;
      break;
    }

    if (result.ok) {
      await db
        .update(schema.user)
        .set({ weeklyDigestLastSentAt: new Date() })
        .where(eq(schema.user.id, recipient.id));
      summary.sent++;
    } else {
      summary.failed++;
      console.warn(
        `[digest] send failed for ${recipient.id}: ${result.error ?? result.status}`,
      );
    }

    if (i < candidates.length - 1 && digestConfig.sendDelayMs > 0) {
      await sleep(digestConfig.sendDelayMs);
    }
  }

  return summary;
}
