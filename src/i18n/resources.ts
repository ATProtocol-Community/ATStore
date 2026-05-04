/**
 * Statically imported translation bundles. Small enough to inline for now;
 * once string volume grows, swap for `i18next-resources-to-backend` lazy loading.
 */
import type { Namespace } from "./config";

import enXAAbout from "./locales/en-XA/about.json";
import enXACommon from "./locales/en-XA/common.json";
import enAbout from "./locales/en/about.json";
import enCommon from "./locales/en/common.json";

export const resources: Record<string, Record<Namespace, unknown>> = {
  en: { common: enCommon, about: enAbout },
  // en-XA is a dev-only pseudo-locale. Rollup replaces import.meta.env.DEV
  // with `false` in prod and tree-shakes the dead branch + JSON assets.
  ...(import.meta.env.DEV
    ? { "en-XA": { common: enXACommon, about: enXAAbout } }
    : {}),
};
