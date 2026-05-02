import type { Locale } from "#/lib/locale";

import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { initI18n } from "#/i18n";
import { DEFAULT_LOCALE, isLocale } from "#/lib/locale";
/**
 * `$locale` parent route — wraps every user-facing page under a locale prefix
 * (`/en/...`, `/pt-BR/...`). Responsibilities:
 *
 *   1. Validate the URL segment against `LOCALES`. Invalid → redirect to the
 *      same path with `DEFAULT_LOCALE` substituted.
 *   2. Initialize `i18next` with the URL's locale so SSR renders the right
 *      strings on first paint.
 *   3. Render `<I18nextProvider>` so descendants can use `useTranslation()`.
 *
 * `<html lang dir>` are still set in `__root.tsx` because that's the only
 * place that renders the document shell — but they read the locale from the
 * URL via a route match, not from a cookie.
 */
import { I18nextProvider } from "react-i18next";

export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params, location }) => {
    if (!isLocale(params.locale)) {
      // Substitute the default locale into the path and bounce.
      const restOfPath = location.pathname.replace(
        /^\/[^/]+/,
        `/${DEFAULT_LOCALE}`,
      );
      throw redirect({
        href: restOfPath + location.searchStr,
      });
    }

    // Temporary to show how route-based locales will work. once /home route is
    // migrated with $locale prefix (next followup PR) we can remove this.

    // Bare `/<locale>` has no index child yet — bounce to the canonical
    if (location.pathname === `/${params.locale}`) {
      throw redirect({
        to: "/$locale/about",
        params: { locale: params.locale },
      });
    }
  },
  component: LocaleRoute,
});

function LocaleRoute() {
  const { locale } = Route.useParams();
  const i18n = initI18n(locale as Locale);
  return (
    <I18nextProvider i18n={i18n}>
      <Outlet />
    </I18nextProvider>
  );
}
