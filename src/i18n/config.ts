/**
 * Static i18n configuration. Re-exports locale primitives from `lib/locale`
 * and adds anything specific to `i18next` setup (namespaces, fallbacks).
 */
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  RTL_LOCALES,
  isLocale,
  isRtlLocale,
  localeDirection,
  matchAcceptLanguage,
  parseLocale,
  type Locale,
} from "../lib/locale";

export const NAMESPACES = ["common"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";
