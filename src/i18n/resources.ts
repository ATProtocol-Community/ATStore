import type { Locale, Namespace } from "./config";

import enXACommon from "./locales/en-XA/common.json";
/**
 * Statically imported translation bundles. Small enough to inline for now;
 * once string volume grows, swap for `i18next-resources-to-backend` lazy loading.
 */
import enCommon from "./locales/en/common.json";

export const resources: Record<Locale, Record<Namespace, unknown>> = {
  en: { common: enCommon },
  "en-XA": { common: enXACommon },
};
