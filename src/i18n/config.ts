/**
 * Static i18n configuration. Re-exports locale primitives from `lib/locale`
 * and adds anything specific to `i18next` setup (namespaces, fallbacks).
 */
export {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  matchAcceptLanguage,
  parseLocale,
  type Locale,
} from "../lib/locale";

/**
 * Namespaces are translation buckets. Split per surface area as string volume
 * grows — keeps merge-conflict surface small when contributors translate
 * different surfaces in parallel. `common` is for site-wide chrome (header,
 * footer, switcher); page-specific surfaces get their own namespace.
 */
export const NAMESPACES = ["common", "about"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";
