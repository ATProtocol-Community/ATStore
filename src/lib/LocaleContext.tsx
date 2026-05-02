import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { locale as localeApi } from "#/integrations/tanstack-query/api-locale.functions";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

export interface LocaleContextValue {
  /** The user's chosen locale (URL is the source of truth). */
  locale: Locale;
  /**
   * Switch locales by navigating to the same path with a different prefix.
   * Also writes the cookie so subsequent unprefixed visits land in the same
   * language.
   */
  setLocale: (next: Locale) => void;
  /** Whether the cookie-write mutation is in flight. */
  isPending: boolean;
}

/**
 * Read + update the locale preference. URL `$locale` segment is canonical;
 * the cookie is just a remembered choice consulted by the unprefixed-path
 * redirect in `__root.tsx`.
 */
export function useLocale(): LocaleContextValue {
  const params = useParams({ strict: false }) as { locale?: string };
  const navigate = useNavigate();
  const location = useLocation();
  const current: Locale = isLocale(params.locale)
    ? params.locale
    : DEFAULT_LOCALE;

  const persistMutation = useMutation({
    mutationFn: (next: Locale) =>
      localeApi.setLocalePreference({ data: { locale: next } }),
  });

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === current) return;
      const nextPath = location.pathname.replace(/^\/[^/]+/, `/${next}`);
      void navigate({ href: nextPath + (location.searchStr ?? "") });
      persistMutation.mutate(next);
    },
    [current, location, navigate, persistMutation],
  );

  return {
    locale: current,
    setLocale,
    isPending: persistMutation.isPending,
  };
}
