import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";

import type { Locale } from "./locale";

import { DEFAULT_LOCALE, isLocale } from "./locale";

export interface LocaleContextValue {
  /** The user's chosen locale (URL is the source of truth). */
  locale: Locale;
  /** Switch locales by navigating to the same path with a different prefix. */
  setLocale: (next: Locale) => void;
}

/**
 * Read + update the locale preference. The `$locale` URL segment is the only
 * source of truth — switching locales is a navigation, not a state mutation.
 */
export function useLocale(): LocaleContextValue {
  const params = useParams({ strict: false }) as { locale?: string };
  const navigate = useNavigate();
  const location = useLocation();
  const current: Locale = isLocale(params.locale)
    ? params.locale
    : DEFAULT_LOCALE;

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === current) return;
      const nextPath = location.pathname.replace(/^\/[^/]+/, `/${next}`);
      void navigate({ href: nextPath + (location.searchStr ?? "") });
    },
    [current, location, navigate],
  );

  return { locale: current, setLocale };
}
