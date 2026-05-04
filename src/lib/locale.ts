/**
 * Locale preference shared types/helpers.
 *
 * The URL is the source of truth: routes live under `/$locale/...`, and the
 * `$locale` segment is the only thing that determines which translation
 * bundle and `<html lang>` apply. There is no cookie — `Accept-Language` is
 * consulted only as a fallback when a visitor lands on an unprefixed path.
 *
 * `en-XA` is a pseudo-locale used to validate the i18n pipeline (every value
 * is transformed so missed/unconverted strings stand out visually). It is not
 * shown in production builds outside of dev.
 */

export const PROD_LOCALES = ["en"] as const;
export type Locale = (typeof PROD_LOCALES)[number] | "en-XA";
export const LOCALES: ReadonlyArray<Locale> = import.meta.env.DEV
  ? [...PROD_LOCALES, "en-XA"]
  : PROD_LOCALES;

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (LOCALES as ReadonlyArray<string>).includes(value)
  );
}

export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Pick the best supported locale from an `Accept-Language` header. Entries
 * are sorted by their `q` quality factor (highest first); for each one we
 * try an exact match against `LOCALES`, then fall back to a base-tag match
 * (e.g. `en-US` → `en`). Returns `DEFAULT_LOCALE` if no entry matches.
 *
 * Header format reference:
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language
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
    .toSorted((a, b) => b.q - a.q);

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
