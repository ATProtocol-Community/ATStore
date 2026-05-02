/**
 * Statically imported translation bundles. Small enough to inline for now;
 * once string volume grows, swap for `i18next-resources-to-backend` lazy loading.
 */
import enCommon from "./locales/en/common.json";
import enXACommon from "./locales/en-XA/common.json";

import type { Locale, Namespace } from "./config";

export const resources: Record<Locale, Record<Namespace, unknown>> = {
  en: { common: enCommon },
  "en-XA": { common: enXACommon },
};
