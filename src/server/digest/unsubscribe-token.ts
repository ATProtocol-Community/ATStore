/**
 * Signed, stateless unsubscribe tokens for the weekly digest. A token is
 * `<userId>.<hmac>` where the HMAC is over `userId` keyed by
 * `DIGEST_UNSUBSCRIBE_SECRET`, so the one-click unsubscribe route can turn the
 * digest off without the recipient being signed in while keeping links
 * unforgeable.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { digestConfig } from "./config";

function sign(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

export function makeUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId, digestConfig.unsubscribeSecret)}`;
}

/** Returns the `userId` a token authorizes, or `null` if the signature doesn't match. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId, digestConfig.unsubscribeSecret));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}
