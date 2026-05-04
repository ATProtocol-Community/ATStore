/**
 * Statically imported translation bundles. Small enough to inline for now;
 * once string volume grows, swap for `i18next-resources-to-backend` lazy loading.
 */
import type { Locale, Namespace } from "./config";

import enXAAbout from "./locales/en-XA/about.json";
import enXACommon from "./locales/en-XA/common.json";
import enAbout from "./locales/en/about.json";
import enCommon from "./locales/en/common.json";

export const resources: Record<Locale, Record<Namespace, unknown>> = {
  en: { common: enCommon, about: enAbout },
  "en-XA": { common: enXACommon, about: enXAAbout },
};
