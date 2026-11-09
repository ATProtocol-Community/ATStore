import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

/**
 * One-click weekly-digest unsubscribe, authorized by the signed token in the link.
 * - GET  → the footer "Unsubscribe" link; turns the digest off and shows a
 *          small confirmation page.
 * - POST → RFC 8058 `List-Unsubscribe-Post` one-click from Gmail / Apple Mail.
 * Requires `DIGEST_UNSUBSCRIBE_SECRET` (same value the send job signs with).
 */
async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const { verifyUnsubscribeToken } =
    await import("#/server/digest/unsubscribe-token");
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;

  const [{ db }, schema] = await Promise.all([
    import("#/db/index.server"),
    import("#/db/schema"),
  ]);
  await db
    .update(schema.user)
    .set({ weeklyDigestEnabled: false })
    .where(eq(schema.user.id, userId));
  return true;
}

function confirmationPage(ok: boolean): Response {
  const title = ok ? "Unsubscribed" : "Invalid link";
  const message = ok
    ? "You’ve been unsubscribed from the AT Store weekly digest. You can turn it back on any time from your settings."
    : "This unsubscribe link isn’t valid. You can manage the weekly digest from your settings.";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · AT Store</title>
<style>
  body { margin:0; background:#f4f6f9; color:#1c2024; font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .wrap { max-width:520px; margin:14vh auto 0; padding:0 24px; text-align:center; }
  h1 { font-size:28px; margin:0 0 12px; }
  p { color:#60646c; font-size:16px; line-height:1.5; margin:0 0 24px; }
  a { color:#2870bd; font-weight:600; text-decoration:none; }
  @media (prefers-color-scheme: dark) { body { background:#111113; color:#edeef0; } p { color:#b0b4ba; } a { color:#70b8ff; } }
</style></head>
<body><div class="wrap">
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/settings">Manage your digest →</a>
</div></body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/digest/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        return confirmationPage(await unsubscribe(token));
      },
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        const ok = await unsubscribe(token);
        return new Response(null, { status: ok ? 200 : 400 });
      },
    },
  },
});
