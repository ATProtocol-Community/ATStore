import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const PROGRESS_VERSION = 1 as const;

export type SkippedListingReason =
  | "manual_skip"
  | "no_tty"
  | "well_known_error"
  | "playwright_error"
  | "well_known_miss_no_browser";

export type SkippedListingRecord = {
  storeListingId: string;
  slug: string;
  skippedAt: string;
  reason: SkippedListingReason;
  note?: string;
};

export type OAuthDiscoveryLocalProgress = {
  version: typeof PROGRESS_VERSION;
  skipped: Record<string, SkippedListingRecord>;
};

function emptyProgress(): OAuthDiscoveryLocalProgress {
  return { version: PROGRESS_VERSION, skipped: {} };
}

/** Default: `oauth-discovery-progress.json` in the current working directory, or `OAUTH_DISCOVERY_PROGRESS_FILE`. */
export function defaultOAuthDiscoveryProgressPath(): string {
  const fromEnv = process.env.OAUTH_DISCOVERY_PROGRESS_FILE?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), "oauth-discovery-progress.json");
}

export async function loadLocalProgress(
  filePath: string,
): Promise<OAuthDiscoveryLocalProgress> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyProgress();
    }
    const o = parsed as Partial<OAuthDiscoveryLocalProgress>;
    const skipped =
      o.skipped && typeof o.skipped === "object" && !Array.isArray(o.skipped)
        ? (o.skipped as Record<string, SkippedListingRecord>)
        : {};
    return { version: PROGRESS_VERSION, skipped };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return emptyProgress();
    throw e;
  }
}

export async function recordSkippedListing(
  filePath: string,
  record: SkippedListingRecord,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const current = await loadLocalProgress(filePath);
  current.skipped[record.slug] = {
    ...record,
    skippedAt: record.skippedAt,
  };
  const tmp = `${filePath}.${String(process.pid)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export function isSlugInLocalSkips(
  progress: OAuthDiscoveryLocalProgress,
  slug: string,
): boolean {
  const r = progress.skipped[slug];
  if (!r) return false;
  return r.reason === "manual_skip" || r.reason === "no_tty";
}
