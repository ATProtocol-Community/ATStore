/**
 * Shared `i18next` instance. Initialized once on the client and reused across
 * every render. The server reads the locale cookie / `Accept-Language` and
 * passes the resolved language down via the query cache so SSR renders the
 * correct strings on first paint.
 */
import i18next, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  LOCALES,
  NAMESPACES,
  type Locale,
} from "./config";
import { resources } from "./resources";

let initialized = false;

export function initI18n(lng: Locale = DEFAULT_LOCALE) {
  if (!initialized) {
    void i18next.use(initReactI18next).init({
      resources: resources as unknown as Resource,
      lng,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: LOCALES as unknown as string[],
      ns: NAMESPACES as unknown as string[],
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    initialized = true;
  } else if (i18next.language !== lng) {
    void i18next.changeLanguage(lng);
  }
  return i18next;
}

export { i18next };
