/**
 * Full Chromium screenshot of a listing URL for Gemini image generation.
 * Waits past `domcontentloaded` so SPAs and lazy assets can paint.
 */
const VIEWPORT = { width: 1440, height: 960 } as const

/** Desktop Chrome UA — avoids some sites serving empty shells to headless defaults. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function captureListingPageScreenshotForGeneration(
  url: string,
): Promise<Buffer> {
  const { chromium } = await import(/* @vite-ignore */ 'playwright')
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      userAgent: BROWSER_USER_AGENT,
      locale: 'en-US',
      ignoreHTTPSErrors:
        process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === '1' ||
        process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === 'true',
    })

    const page = await context.newPage()

    await page.goto(url.trim(), {
      waitUntil: 'load',
      timeout: 60_000,
    })

    try {
      await page.waitForLoadState('networkidle', { timeout: 25_000 })
    } catch {
      /* Long-polling, analytics, or SSE — still take a representative frame */
    }

    await page.emulateMedia({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })

    await page.evaluate(async () => {
      try {
        if (document.fonts) {
          await document.fonts.ready
        }
      } catch {
        /* ignore */
      }
    })

    await page.waitForTimeout(2_000)

    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })

    const buffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      animations: 'disabled',
    })

    await context.close()
    return buffer
  } finally {
    await browser.close()
  }
}
