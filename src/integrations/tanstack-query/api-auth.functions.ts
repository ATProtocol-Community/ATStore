import type { ActorIdentifier } from "@atcute/lexicons";

import { isDid } from "@atcute/lexicons/syntax";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { atprotoOAuth } from "#/integrations/auth/atproto";
import { fetchBlueskyPublicProfileFields } from "#/lib/bluesky-public-profile";
import { sanitizeAuthRedirectTarget } from "#/utils/auth-redirect";
import { getSavedHandles } from "#/utils/saved-handles";
import { z } from "zod";

const authorizeInputSchema = z
  .object({
    handle: z.string().optional(),
    // DID hint carried across the atmosphere (see docs/atmosphere-login.md).
    // Used as the OAuth target identifier when no handle is supplied.
    referrerDid: z.string().optional(),
    redirect: z.string().optional(),
  })
  .refine((data) => Boolean(data.handle?.trim() || data.referrerDid?.trim()), {
    message: "handle or referrerDid is required",
  });

const authorize = createServerFn({ method: "GET" })
  .inputValidator(authorizeInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const handle = data.handle?.replace(/^@/, "").trim() || undefined;
    const referrerDid = data.referrerDid?.trim();

    // Prefer an explicit handle; otherwise fall back to the referrer DID hint.
    // A DID is a valid ActorIdentifier, so OAuth can start straight from it and
    // the callback resolves the handle from the DID's public profile.
    const identifier = handle ?? referrerDid;
    if (!identifier || (identifier === referrerDid && !isDid(identifier))) {
      throw new Error("A valid handle or referrer DID is required.");
    }

    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: identifier as ActorIdentifier,
      },
      state: {
        redirect: redirectTarget,
        // Only carry a handle when we actually have one; the callback fills it
        // in from the resolved DID otherwise.
        ...(handle ? { handle } : {}),
      },
    });

    return { authorizationUrl: url.toString() };
  });

const referrerLoginInputSchema = z.object({
  referrerDid: z.string(),
  redirect: z.string().optional(),
});

/**
 * Resolve a `referrer_did` hint into a one-tap sign-in: the DID's public handle
 * + avatar (best effort) and a ready-to-use OAuth authorization URL. Returns
 * null when the hint isn't a valid DID so the caller can just ignore it.
 */
const getReferrerLogin = createServerFn({ method: "GET" })
  .inputValidator(referrerLoginInputSchema)
  .handler(async ({ data }) => {
    const did = data.referrerDid.trim();
    if (!isDid(did)) {
      return null;
    }

    const request = getRequest();
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const profile = await fetchBlueskyPublicProfileFields(did);
    const handle = profile?.handle ?? null;

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: did as ActorIdentifier,
      },
      state: {
        redirect: redirectTarget,
        ...(handle ? { handle } : {}),
      },
    });

    return {
      did,
      handle,
      avatar: profile?.avatarUrl ?? null,
      authorizationUrl: url.toString(),
    };
  });

const singupInputSchema = z.object({
  redirect: z.string().optional(),
});

const singup = createServerFn({ method: "GET" })
  .inputValidator(singupInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      prompt: "create",
      target: {
        type: "pds",
        serviceUrl: "https://selfhosted.social/",
      },
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

const getSavedHandlesServer = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  const cookieHeader = request.headers.get("cookie");
  return getSavedHandles(cookieHeader);
});

const getSavedHandlesQueryOptions = queryOptions({
  queryKey: ["savedHandles"],
  queryFn: async () => {
    return await getSavedHandlesServer();
  },
});

export const auth = {
  authorize,
  getReferrerLogin,
  singup,
  getSavedHandles: getSavedHandlesServer,
  getSavedHandlesQueryOptions,
};
