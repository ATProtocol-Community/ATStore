import type { Page } from "playwright";

export type PlaywrightLoginCandidate = { href: string; text: string };

const CLIENT_METADATA_PATH_RE =
  /client-metadata|oauth-client-metadata|oauth_authorization_server|oauth-authorization-server/i;

export function looksLikeOAuthClientMetadataUrl(url: string): boolean {
  const base = url.split("?")[0]?.toLowerCase() ?? "";
  if (base.endsWith(".json") && CLIENT_METADATA_PATH_RE.test(base)) {
    return true;
  }
  return (
    base.includes("/.well-known/oauth-client-metadata.json") ||
    base.includes("/.well-known/client-metadata.json") ||
    base.includes("/.well-known/client-metadata")
  );
}

export function attachClientMetadataCapture(
  page: Page,
  sink: Set<string>,
): () => void {
  const onResponse = (response: { url: () => string; ok: () => boolean }) => {
    try {
      if (!response.ok()) return;
      const raw = response.url();
      if (looksLikeOAuthClientMetadataUrl(raw)) {
        sink.add(raw.split("?")[0] ?? raw);
      }
    } catch {
      /* ignore */
    }
  };
  page.on("response", onResponse);
  return () => page.off("response", onResponse);
}

export async function collectLoginLinkCandidates(
  page: Page,
): Promise<Array<PlaywrightLoginCandidate>> {
  return page.evaluate(() => {
    const re =
      /sign\s*in|log\s*in|connect|bluesky|atproto|get started|continue with/i;
    const out: Array<{ href: string; text: string }> = [];
    const seen = new Set<string>();
    for (const a of document.querySelectorAll("a[href]")) {
      const el = a as HTMLAnchorElement;
      const text = (el.textContent ?? "").replaceAll(/\s+/g, " ").trim();
      if (!re.test(text)) continue;
      try {
        const href = el.href;
        if (seen.has(href)) continue;
        seen.add(href);
        out.push({ href, text: text.slice(0, 240) });
      } catch {
        /* ignore invalid href */
      }
    }
    return out;
  });
}

export async function readAuthHintsFromBody(page: Page): Promise<{
  appPasswordMentioned: boolean;
  oauthMentioned: boolean;
}> {
  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 150_000);
  const low = text.toLowerCase();
  return {
    appPasswordMentioned:
      /\bapp password\b|app-specific password|application password|app passwords/i.test(
        text,
      ),
    oauthMentioned:
      /\boauth\b|oauth 2|authorization server|sign in with bluesky|atproto oauth/i.test(
        low,
      ),
  };
}

function oauthishCandidate(c: PlaywrightLoginCandidate): boolean {
  const { href, text } = c;
  const pack = `${href} ${text}`.toLowerCase();
  return (
    pack.includes("oauth") ||
    pack.includes("authorize") ||
    pack.includes("client_id") ||
    pack.includes("bluesky") ||
    pack.includes("atproto") ||
    pack.includes("bsky")
  );
}

/**
 * Follow a few likely login entrypoint links. Install {@link attachClientMetadataCapture}
 * on `page` before calling so JSON metadata responses accumulate in your own `Set`.
 */
export async function exploreLoginEntrypoints(page: Page): Promise<{
  visitedUrls: Array<string>;
}> {
  const visited: Array<string> = [];
  const candidates = await collectLoginLinkCandidates(page);
  const ordered = [
    ...candidates.filter(oauthishCandidate),
    ...candidates.filter((c) => !oauthishCandidate(c)),
  ].slice(0, 6);

  for (const c of ordered) {
    try {
      await page.goto(c.href, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      visited.push(page.url());
      await page.waitForTimeout(1800);
    } catch {
      /* continue */
    }
  }

  return { visitedUrls: visited };
}

/** First matching https? URL inside the document’s first `h3` (common on PDS login UIs). */
export async function extractHttpUrlFromFirstH3(
  page: Page,
): Promise<{ rawText: string; url: string | null }> {
  const rawText = await page.evaluate(() => {
    const h3 = document.querySelector("h3");
    return (h3?.textContent ?? "").replaceAll(/\s+/g, " ").trim();
  });
  if (!rawText) {
    return { rawText: "", url: null };
  }
  const m = rawText.match(/https?:\/\/[^\s<>"')\]]+/iu);
  let url = m?.[0] ?? null;
  if (url) {
    url = url.replace(/[.,;:!?)]+$/u, "");
  }
  return { rawText, url };
}

/**
 * Minimal Bluesky-style identifier + password form (may work on PDS / OAuth login pages).
 * Uses env-provided test credentials; never log secrets.
 */
export async function tryBlueskyishIdentifierLogin(
  page: Page,
  handle: string,
  password: string,
): Promise<boolean> {
  const handleBox = page
    .locator('input[name="identifier"]')
    .or(page.locator("#identifier"))
    .or(page.locator('input[autocomplete="username"]'))
    .first();
  try {
    await handleBox.waitFor({ state: "visible", timeout: 6000 });
  } catch {
    return false;
  }

  const passBox = page.locator('input[type="password"]').first();
  if (!(await passBox.isVisible().catch(() => false))) {
    return false;
  }

  await handleBox.fill(handle);
  await passBox.fill(password);

  const submit = page
    .locator('button[type="submit"]')
    .or(page.getByRole("button", { name: /sign in|log in|continue|next/i }))
    .first();
  if (await submit.isVisible().catch(() => false)) {
    await submit.click().catch(() => {});
    await page.waitForTimeout(4000);
    return true;
  }
  return false;
}
