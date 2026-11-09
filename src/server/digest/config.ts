function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Getters so the web app can import this module without the comail keys set —
 * a missing var only throws when the value is actually read.
 */
export const digestConfig = {
  /** comail send endpoint (override for testing); defaults to the hosted API. */
  get comailSendUrl(): string {
    return process.env.COMAIL_SEND_URL ?? "https://smtp.atmos.email/v1/send";
  },
  /** Sending account DID (comail `X-Atmos-DID`). */
  get comailDid(): string {
    return required("COMAIL_DID");
  },
  /** comail API key (`Authorization: Bearer <key>`). */
  get comailApiKey(): string {
    return required("COMAIL_API_KEY");
  },
  /** From address on the enrolled sending domain (e.g. `digest@atstore.fyi`). */
  get comailFrom(): string {
    return required("COMAIL_FROM");
  },
  get comailFromName(): string {
    return process.env.COMAIL_FROM_NAME ?? "AT Store";
  },
  /**
   * HMAC key for one-click unsubscribe tokens. Required in production; in dev it
   * falls back to a static placeholder so the preview route works without setup.
   */
  get unsubscribeSecret(): string {
    const value = process.env.DIGEST_UNSUBSCRIBE_SECRET;
    if (value) return value;
    if (process.env.NODE_ENV !== "production") return "dev-preview-secret";
    throw new Error("DIGEST_UNSUBSCRIBE_SECRET is not set");
  },
  /**
   * comail's account ceiling is 50–100/hr and 500–1000/day; the runner sends
   * sequentially and stops at this cap. Unsent users are picked up next run
   * because their `weeklyDigestLastSentAt` stays stale.
   */
  get maxPerRun(): number {
    const raw = process.env.DIGEST_MAX_PER_RUN;
    const n = raw ? Number.parseInt(raw, 10) : 90;
    return Number.isFinite(n) && n > 0 ? n : 90;
  },
  /** Milliseconds to wait between sends (throttle under the hourly ceiling). */
  get sendDelayMs(): number {
    const raw = process.env.DIGEST_SEND_DELAY_MS;
    const n = raw ? Number.parseInt(raw, 10) : 1500;
    return Number.isFinite(n) && n >= 0 ? n : 1500;
  },
} as const;

/** Public site origin used for links in emails (no trailing slash). */
export function getDigestBaseUrl(): string {
  const url =
    process.env.ATSTORE_WEBSITE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.ATPROTO_BASE_URL?.trim() ||
    "https://atstore.fyi";
  return url.replace(/\/$/, "");
}

export function digestUnsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/digest/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** New apps are capped, not padded — a quiet week may have fewer. */
export const DIGEST_NEW_APPS_LIMIT = 8;
/** Always filled (see `buildDigest`) as long as the store has this many apps. */
export const DIGEST_TRENDING_APPS_LIMIT = 5;
export const DIGEST_WINDOW_DAYS = 7;
/** Idempotency guard: skip users sent a digest within this many days. */
export const DIGEST_MIN_INTERVAL_DAYS = 6;
