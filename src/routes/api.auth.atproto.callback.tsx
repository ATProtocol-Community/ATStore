import type { OAuthSession } from "@atcute/oauth-node-client";

import { Client } from "@atcute/client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { db } from "#/db/index.server";
import * as schema from "#/db/schema";
import { atprotoOAuth } from "#/integrations/auth/atproto";
import { AUTH_SESSION_TOKEN_COOKIE } from "#/integrations/auth/constants";
import { hasEmailScope } from "#/integrations/auth/scope";
import { ensureProfileSelfRecord } from "#/lib/atproto/repo-records";
import {
  fetchBlueskyPublicProfileFields,
  shouldApplyBlueskyAvatarFromPublicUrl,
} from "#/lib/bluesky-public-profile";
import {
  cookieHeaderSkipsProductClaim,
  countEligibleProductClaimsForDid,
} from "#/lib/product-claim-eligibility";
import { sanitizeAuthRedirectTarget } from "#/utils/auth-redirect";
import { and, eq } from "drizzle-orm";

async function syncDigestEmail(opts: {
  oauthSession: OAuthSession;
  userId: string;
  displayName: string;
  priorUser: typeof schema.user.$inferSelect | null;
}) {
  let email: string | null = null;
  let emailConfirmed = false;
  try {
    const client = new Client({ handler: opts.oauthSession });
    const res = await client.get("com.atproto.server.getSession", {});
    if (res.ok) {
      email = res.data.email?.trim() || null;
      emailConfirmed = res.data.emailConfirmed === true;
    }
  } catch (error) {
    console.warn("Failed to read account email on callback:", error);
  }
  if (!email) return;

  try {
    await db
      .update(schema.user)
      .set({ email, emailVerified: emailConfirmed })
      .where(eq(schema.user.id, opts.userId));
  } catch (error) {
    // `user.email` is unique — another at-store account may share this address.
    console.warn("Failed to persist account email on callback:", error);
    return;
  }

  // `upgradeToWeeklyDigest` set the flag before redirecting here, so the row
  // read at the top of the callback already reflects the opt-in.
  const prior = opts.priorUser;
  if (prior?.weeklyDigestEnabled && !prior.weeklyDigestWelcomeSentAt) {
    const { sendDigestWelcomeEmail } =
      await import("#/server/digest/welcome.server");
    const sent = await sendDigestWelcomeEmail({
      userId: opts.userId,
      email,
      displayName: opts.displayName,
    });
    if (sent) {
      await db
        .update(schema.user)
        .set({ weeklyDigestWelcomeSentAt: new Date() })
        .where(eq(schema.user.id, opts.userId));
    }
  }
}

export const Route = createFileRoute("/api/auth/atproto/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const callbackUrl = new URL(request.url);
          const callbackError = callbackUrl.searchParams.get("error");
          if (callbackError) {
            console.warn("OAuth callback error param:", callbackError);
          }

          const { session: oauthSession, state } = await atprotoOAuth.callback(
            callbackUrl.searchParams,
          );

          const did = oauthSession.did;
          const stateData = state as
            | { redirect?: string; returnTo?: string; handle?: string }
            | undefined;
          const requestedReturnTo = stateData?.redirect ?? stateData?.returnTo;
          let returnTo = sanitizeAuthRedirectTarget(
            requestedReturnTo,
            request.url,
          );

          const skipClaim = cookieHeaderSkipsProductClaim(
            request.headers.get("cookie"),
          );
          const defaultHome = returnTo === "/" || returnTo === "";
          if (!skipClaim && defaultHome) {
            try {
              const n = await countEligibleProductClaimsForDid(db, did);
              if (n > 0) {
                returnTo = "/product/claim";
              }
            } catch (error) {
              console.warn("Product claim eligibility check failed:", error);
            }
          }

          const [publicProfile, existingUserByDid, existingAccount] =
            await Promise.all([
              fetchBlueskyPublicProfileFields(did),
              db.query.user.findFirst({
                where: eq(schema.user.did, did),
              }),
              db.query.account.findFirst({
                where: and(
                  eq(schema.account.accountId, did),
                  eq(schema.account.providerId, "atproto"),
                ),
                with: { user: true },
              }),
            ]);

          const handle = stateData?.handle || publicProfile?.handle || "";
          const displayName = publicProfile?.displayName || handle || did;
          const blueskyAvatarUrl = publicProfile?.avatarUrl ?? null;

          let avatar: string | undefined = blueskyAvatarUrl ?? undefined;
          if (!avatar && existingUserByDid?.image) {
            avatar = existingUserByDid.image;
          } else if (!avatar && existingAccount?.user?.image) {
            avatar = existingAccount.user.image;
          }

          let userId: string;

          if (existingUserByDid) {
            userId = existingUserByDid.id;
          } else if (existingAccount) {
            userId = existingAccount.userId;
          } else {
            userId = crypto.randomUUID();
            await db.insert(schema.user).values({
              id: userId,
              name: displayName,
              did,
              emailVerified: true,
              image: avatar || undefined,
            });
          }

          const priorUser = existingUserByDid ?? existingAccount?.user ?? null;
          if (
            priorUser &&
            blueskyAvatarUrl &&
            shouldApplyBlueskyAvatarFromPublicUrl(
              priorUser.image,
              blueskyAvatarUrl,
            )
          ) {
            await db
              .update(schema.user)
              .set({ image: blueskyAvatarUrl })
              .where(eq(schema.user.id, userId));
          }

          let grantedScope: string | null = null;
          try {
            const tokenInfo = await oauthSession.getTokenInfo();
            grantedScope = tokenInfo.scope;
          } catch (error) {
            console.warn("Failed to read granted OAuth scope:", error);
          }

          if (existingAccount) {
            await db
              .update(schema.account)
              .set({ scope: grantedScope })
              .where(eq(schema.account.id, existingAccount.id));
          } else {
            await db.insert(schema.account).values({
              id: crypto.randomUUID(),
              accountId: did,
              providerId: "atproto",
              userId,
              scope: grantedScope,
            });
          }

          // Weekly digest: the PDS only returns the email when the user granted
          // `transition:email` (requested once they opt in).
          if (hasEmailScope(grantedScope)) {
            await syncDigestEmail({
              oauthSession,
              userId,
              displayName,
              priorUser,
            });
          }

          const sessionToken = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await db.insert(schema.session).values({
            id: crypto.randomUUID(),
            token: sessionToken,
            userId,
            expiresAt,
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
          });

          try {
            const atprotoClient = new Client({ handler: oauthSession });
            await ensureProfileSelfRecord(atprotoClient, did, {
              displayName,
            });
          } catch (error) {
            console.warn("Failed to ensure fyi.atstore.profile record:", error);
          }

          const isSecure = request.url.startsWith("https://");
          const cookieAttributes = [
            `Path=/`,
            `HttpOnly`,
            `SameSite=Lax`,
            ...(isSecure ? ["Secure"] : []),
            `Max-Age=${30 * 24 * 60 * 60}`,
          ].join("; ");

          const headers = new Headers();
          const baseUrl = new URL(request.url);
          const redirectUrl = returnTo.startsWith("http")
            ? new URL(returnTo)
            : new URL(returnTo, `${baseUrl.protocol}//${baseUrl.host}`);

          redirectUrl.searchParams.set("loginSuccess", "true");
          if (handle) {
            redirectUrl.searchParams.set("handle", handle);
          }
          redirectUrl.searchParams.set("avatar", avatar || "");

          headers.set("Location", redirectUrl.toString());
          headers.append(
            "Set-Cookie",
            `${AUTH_SESSION_TOKEN_COOKIE}=${sessionToken}; ${cookieAttributes}`,
          );

          return new Response(null, {
            status: 302,
            headers,
          });
        } catch (error) {
          console.error("Atproto OAuth callback error:", error);
          throw redirect({
            href: "/login?error=oauth_failed",
          });
        }
      },
    },
  },
});
