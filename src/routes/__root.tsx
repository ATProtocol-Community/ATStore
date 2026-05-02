import type { QueryClient } from "@tanstack/react-query";

import * as stylex from "@stylexjs/stylex";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQuery } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { saveHandle } from "#/utils/saved-handles";
import { useLayoutEffect } from "react";

import type { Locale } from "../lib/locale";

import { primaryColor } from "../design-system/theme/color.stylex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { initI18n } from "../i18n";
import { user } from "../integrations/tanstack-query/api-user.functions";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { matchAcceptLanguage } from "../lib/locale";
import { DEFAULT_THEME_MODE } from "../lib/theme";
import appCss from "../styles.css?url";

// Eagerly initialize i18next so `useTranslation` works on any route — even
// top-level ones outside `$locale` (where the `<I18nextProvider>` lives).
// Idempotent: subsequent `initI18n` calls (e.g. from `$locale.tsx` to switch
// languages) reuse the same instance and just call `changeLanguage`.
initI18n();

/**
 * Server-side locale detection for unprefixed-path redirects. URL is the
 * source of truth, so the only fallback is `Accept-Language` (and
 * `DEFAULT_LOCALE` if nothing matches).
 */
const detectLocale = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale }> => {
    const acceptLanguage = getRequest().headers.get("accept-language");
    return { locale: matchAcceptLanguage(acceptLanguage) };
  },
);

/**
 * Top-level paths whose route file was moved under `$locale/...`. When one
 * of these is hit without a locale prefix, the top-level route no longer
 * exists — so we redirect to the locale-prefixed version. Append to this
 * list as more surfaces are migrated.
 */
const MIGRATED_TOP_LEVEL_PATHS: ReadonlySet<string> = new Set(["/about"]);

const primaryColorTheme = stylex.createTheme(primaryColor, {
  bg: blue.bg,
  bgSubtle: blue.bgSubtle,
  component1: blue.component1,
  component2: blue.component2,
  component3: blue.component3,
  border1: blue.border1,
  border2: blue.border2,
  border3: blue.border3,
  solid1: blue.solid1,
  solid2: blue.solid2,
  text1: blue.text1,
  text2: blue.text2,
  textContrast: "white",
});

if (import.meta.env.DEV) {
  void import("virtual:stylex:runtime");
}

interface MyRouterContext {
  queryClient: QueryClient;
}

/**
 * Color-scheme rules for the three theme modes. Combined with the design
 * system's `light-dark()` color tokens this is the only thing the page needs
 * to render with the correct palette — no JS required at first paint, so SSR
 * never flashes the wrong scheme.
 */
const COLOR_SCHEME_CSS = `
html[data-theme="light"] { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="system"] { color-scheme: light; }
@media (prefers-color-scheme: dark) {
  html[data-theme="system"] { color-scheme: dark; }
}
`.trim();

/**
 * Inherited outline color for focused elements (matches `blue.border3`).
 * Defined as global CSS so we do not use legacy contextual selectors under
 * `stylex.create()` (disallowed by @stylexjs/valid-styles).
 */
const GLOBAL_FOCUS_OUTLINE_CSS = `
:is(*) * {
  outline-color: light-dark(#5eb1ef, #2870bd);
}
@media (color-gamut: p3) {
  :is(*) * {
    outline-color: light-dark(color(display-p3 0.451 0.688 0.917), color(display-p3 0.239 0.434 0.72));
  }
}
`.trim();

const THEME_STYLE_TAG_HTML = [COLOR_SCHEME_CSS, GLOBAL_FOCUS_OUTLINE_CSS].join(
  "\n\n",
);

/**
 * OAuth callback appends loginSuccess, handle, and avatar to the real browser
 * URL. TanStack Router's `location.href` is built only from validated route
 * search, so those params are often missing there—read `window.location`
 * instead.
 */
function PersistOAuthSavedHandle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useLayoutEffect(() => {
    if (globalThis.window === undefined) return;

    let url: URL;
    try {
      url = new URL(globalThis.location.href);
    } catch {
      return;
    }
    const loginSuccess = url.searchParams.get("loginSuccess");
    const handleParam = url.searchParams.get("handle");
    const avatarParam = url.searchParams.get("avatar");
    if (loginSuccess === "true" && handleParam && handleParam.trim() !== "") {
      const avatar =
        avatarParam && avatarParam.trim() !== "" ? avatarParam : null;
      saveHandle(handleParam.trim(), avatar);

      url.searchParams.delete("loginSuccess");
      url.searchParams.delete("handle");
      url.searchParams.delete("avatar");
      const qs = url.searchParams.toString();
      const next = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
      globalThis.history.replaceState({}, "", next);
    }
  }, [pathname]);

  return null;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    // If the user hits an unprefixed top-level path that we've migrated under
    // `$locale/...`, redirect to the locale-prefixed version (the top-level
    // file no longer exists). Untouched routes are left alone, so this PR
    // can ship without migrating every surface.
    const pathname = location.pathname;
    if (MIGRATED_TOP_LEVEL_PATHS.has(pathname)) {
      const { locale: detected } = await detectLocale();
      throw redirect({
        href: `/${detected}${pathname}${location.searchStr ?? ""}`,
      });
    }

    await Promise.all([
      context.queryClient.ensureQueryData(user.getSessionQueryOptions),
      context.queryClient.ensureQueryData(user.getThemePreferenceQueryOptions),
    ]);
  },
  head: () => ({
    meta: [
      {
        charSet: "utf8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "at-store",
      },
    ],
    scripts:
      process.env.NODE_ENV === "production"
        ? [
            {
              src: "https://plausible.io/js/pa-vYxpm8_Go6WhakPdNXp_6.js",
              async: true,
            },
            {
              children: `
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
          plausible.init()
        `,
            },
          ]
        : [],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },

      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/logo.svg",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      import.meta.env.DEV
        ? {
            rel: "stylesheet",
            href: "/virtual:stylex.css",
          }
        : null,
    ].filter((i) => i !== null),
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  // Read theme from the prefilled query cache (populated by `beforeLoad`).
  // Subscribing via `useQuery` lets the menu's mutation re-render <html>.
  const { data: themePreference } = useQuery({
    ...user.getThemePreferenceQueryOptions,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const themeMode = themePreference?.mode ?? DEFAULT_THEME_MODE;

  return (
    <html lang="en" data-theme={themeMode} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_STYLE_TAG_HTML }} />
        <HeadContent />
      </head>
      <body {...stylex.props(primaryColorTheme)}>
        <PersistOAuthSavedHandle />
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
