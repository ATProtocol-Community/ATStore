/**
 * Locale preference shared types/helpers.
 *
 * The user's choice is one of the supported `Locale` values. We persist it in
 * the `at-store-locale` cookie so SSR can render the correct language on first
 * paint without a hydration flash.
 *
 * `en-XA` is a pseudo-locale used to validate the i18n pipeline (every value
 * is transformed so missed/unconverted strings stand out visually). It is not
 * shown in production builds outside of dev.
 */

export const LOCALES = ["en", "en-XA"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that mirrors the user's choice. */
export const LOCALE_COOKIE = "at-store-locale";

/** One year — long-lived so guests keep their choice across visits. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Locales that render right-to-left. Empty for now — the field is the hook
 * for the eventual RTL CSS audit (logical properties, etc.).
 */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set();

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}

/**
 * Pick the best supported locale from an `Accept-Language` header.
 * Returns `DEFAULT_LOCALE` if no entry matches.
 */
export function matchAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: (tag ?? "").toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((e) => e.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    const base = tag.split("-")[0];
    const baseMatch = LOCALES.find(
      (l) => l.toLowerCase().split("-")[0] === base,
    );
    if (baseMatch) return baseMatch;
  }
  return DEFAULT_LOCALE;
}
