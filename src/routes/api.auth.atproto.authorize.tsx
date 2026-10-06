import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
  handle: z.string().optional(),
  // DID hint from another atmosphere app (see docs/atmosphere-login.md).
  referrer_did: z.string().optional(),
});

export const Route = createFileRoute("/api/auth/atproto/authorize")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const handleParam = search.handle?.trim();
    const referrerDid = search.referrer_did?.trim();

    // Need something to authorize against — a handle the user typed, or a
    // referrer DID hint. With neither, send them to the login page to choose.
    if (!handleParam && !referrerDid) {
      throw redirect({
        to: "/login",
      });
    }

    const result = await auth.authorize({
      data: {
        handle: handleParam,
        referrerDid,
        redirect: search.redirect,
      },
    });

    throw redirect({
      href: result.authorizationUrl,
    });
  },
});
