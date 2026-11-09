import type { ActorIdentifier, Did } from "@atcute/lexicons";

import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  atprotoOAuth,
  revokeAtprotoSession,
} from "#/integrations/auth/atproto";
import { resolveRequestScope } from "#/integrations/auth/scope";
import { resolveBlueskyHandleToDid } from "#/lib/bluesky-public-profile";
import { maybeAuthMiddleware } from "#/middleware/auth";
import { sanitizeAuthRedirectTarget } from "#/utils/auth-redirect";
import { getSavedHandles } from "#/utils/saved-handles";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbMiddleware } from "./db-middleware";

/**
 * Users who opted into the weekly digest re-request `transition:email` on every
 * sign-in so their stored email stays fresh. Resolution failures fall back to
 * the basic scope — sign-in must never break over this.
 */
async function shouldRequestEmailScope(identifier: string): Promise<boolean> {
  try {
    const did = identifier.startsWith("did:")
      ? identifier
      : await resolveBlueskyHandleToDid(identifier);
    if (!did) return false;
    const [{ db }, schema] = await Promise.all([
      import("#/db/index.server"),
      import("#/db/schema"),
    ]);
    const row = await db.query.user.findFirst({
      where: eq(schema.user.did, did),
      columns: { weeklyDigestEnabled: true },
    });
    return row?.weeklyDigestEnabled === true;
  } catch (error) {
    console.warn("Failed to resolve digest email scope for sign-in:", error);
    return false;
  }
}

const authorizeInputSchema = z.object({
  handle: z.string().min(1, "Handle is required"),
  redirect: z.string().optional(),
});

const authorize = createServerFn({ method: "GET" })
  .inputValidator(authorizeInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const handle = data.handle.replace(/^@/, "").trim() as ActorIdentifier;
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: handle,
      },
      scope: resolveRequestScope(atprotoOAuth.metadata.scope, {
        email: await shouldRequestEmailScope(handle),
      }),
      state: {
        redirect: redirectTarget,
        handle,
      },
    });

    return { authorizationUrl: url.toString() };
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
      scope: resolveRequestScope(atprotoOAuth.metadata.scope, {
        email: false,
      }),
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

const upgradeToWeeklyDigestInputSchema = z.object({
  redirect: z.string().optional(),
});

/**
 * Opt the signed-in user into the weekly digest: sets the flag, then re-runs
 * OAuth with `transition:email` so the PDS asks to share the account email.
 * The callback reads the email and sends the one-time welcome.
 */
const upgradeToWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, maybeAuthMiddleware])
  .inputValidator(upgradeToWeeklyDigestInputSchema)
  .handler(async ({ data, context }) => {
    const sessionUser = context?.session?.user;
    if (!sessionUser?.did) {
      throw new Error("Unauthorized");
    }

    await context.db
      .update(context.schema.user)
      .set({ weeklyDigestEnabled: true, weeklyDigestPromptDismissed: true })
      .where(eq(context.schema.user.id, sessionUser.id));

    try {
      await revokeAtprotoSession(sessionUser.did as Did);
    } catch (error) {
      console.warn(
        "Failed to revoke Atproto session during weekly digest upgrade:",
        error,
      );
    }

    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      getRequest().url,
    );
    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: sessionUser.did as ActorIdentifier,
      },
      scope: resolveRequestScope(atprotoOAuth.metadata.scope, { email: true }),
      state: { redirect: redirectTarget },
    });

    return { authorizationUrl: url.toString() };
  });

/**
 * Turn the digest off. No re-auth — the email grant is harmless to keep and
 * dropping it would force a consent round-trip on re-enable. Same effect as
 * the one-click unsubscribe route.
 */
const disableWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, maybeAuthMiddleware])
  .handler(async ({ context }) => {
    const sessionUser = context?.session?.user;
    if (!sessionUser) {
      throw new Error("Unauthorized");
    }
    await context.db
      .update(context.schema.user)
      .set({ weeklyDigestEnabled: false })
      .where(eq(context.schema.user.id, sessionUser.id));
    return { ok: true };
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
  singup,
  upgradeToWeeklyDigest,
  disableWeeklyDigest,
  getSavedHandles: getSavedHandlesServer,
  getSavedHandlesQueryOptions,
};
