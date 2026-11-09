import { createFileRoute } from "@tanstack/react-router";
import { getAtprotoSessionForRequest } from "#/middleware/auth";

/**
 * Signed-in preview of this week's digest as it would be sent right now
 * (rendered in an iframe from the settings page). Unsubscribe link is omitted.
 */
export const Route = createFileRoute("/api/digest/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getAtprotoSessionForRequest(request);
        if (!session) {
          return new Response("Unauthorized", { status: 401 });
        }

        const [
          { db },
          { buildDigest },
          { getDigestBaseUrl },
          { renderDigestEmail },
        ] = await Promise.all([
          import("#/db/index.server"),
          import("#/server/digest/builder"),
          import("#/server/digest/config"),
          import("#/server/digest/render"),
        ]);
        const baseUrl = getDigestBaseUrl();
        const digest = await buildDigest(db, { baseUrl });
        const { html } = await renderDigestEmail(digest, { baseUrl });

        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
