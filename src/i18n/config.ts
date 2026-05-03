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

export const NAMESPACES = ["common"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";
