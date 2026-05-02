/**
 * Shared `i18next` instance. Initialized once and reused across every render.
 * The `$locale` URL segment is the source of truth — `initI18n(lng)` is
 * called from the `$locale` route's component so SSR renders the correct
 * strings on first paint.
 */
import type { Resource } from "i18next";

import i18next, { changeLanguage, use as i18nextUse } from "i18next";
import { initReactI18next } from "react-i18next";

import type { Locale } from "./config";

import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  LOCALES,
  NAMESPACES,
} from "./config";
import { resources } from "./resources";

let initialized = false;

export function initI18n(lng: Locale = DEFAULT_LOCALE) {
  if (!initialized) {
    void i18nextUse(initReactI18next).init({
      resources: resources as unknown as Resource,
      lng,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: LOCALES as unknown as Array<string>,
      ns: NAMESPACES as unknown as Array<string>,
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    initialized = true;
  } else if (i18next.language !== lng) {
    void changeLanguage(lng);
  }
  return i18next;
}

export { i18next };
