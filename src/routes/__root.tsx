import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useMatches,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import * as stylex from "@stylexjs/stylex";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getGeneratedBannerRecordUrlsQueryOptions } from "../integrations/tanstack-query/api-banner-record-urls.functions";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { primaryColor } from "../design-system/theme/color.stylex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { DEFAULT_THEME_MODE } from "../lib/theme";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  localeDirection,
  matchAcceptLanguage,
  parseLocale,
  type Locale,
} from "../lib/locale";

/**
 * Server-side locale detection for unprefixed-path redirects. Cookie wins
 * (manual choice persists), then `Accept-Language`, then default.
 */
const detectLocale = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale }> => {
    const cookieValue = getCookie(LOCALE_COOKIE);
    if (isLocale(cookieValue)) return { locale: cookieValue };
    const acceptLanguage = getRequest().headers.get("accept-language");
    return { locale: matchAcceptLanguage(acceptLanguage) };
  },
);

/**
 * Path prefixes that should NOT be redirected through a locale segment —
 * server-only endpoints + locale-agnostic OG image generation.
 */
const LOCALE_REDIRECT_SKIP_PREFIXES = ["/api/", "/og", "/_"];

const styles = stylex.create({
  body: {
    ":is(*) *": {
      outlineColor: blue.border3,
    },
  },
});

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
 * Safely serializes a JSON object for embedding inside a `<script>` tag.
 * Escapes `</` so a stray `</script>` inside a value can't close the tag.
 */
function safeJsonForScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    // Redirect any URL whose first path segment isn't a supported locale to
    // `/<detected-locale>/<rest>`. Skip server endpoints / locale-agnostic
    // assets so OAuth callbacks and OG images still work.
    const pathname = location.pathname;
    const skip = LOCALE_REDIRECT_SKIP_PREFIXES.some(
      (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
    );
    if (!skip) {
      const firstSegment = pathname.split("/")[1] ?? "";
      if (!isLocale(firstSegment)) {
        const { locale: detected } = await detectLocale();
        const rest = pathname === "/" ? "" : pathname;
        throw redirect({
          href: `/${detected}${rest}${location.searchStr ?? ""}`,
        });
      }
    }

    await Promise.all([
      context.queryClient.ensureQueryData(user.getSessionQueryOptions),
      context.queryClient.ensureQueryData(
        getGeneratedBannerRecordUrlsQueryOptions,
      ),
      context.queryClient.ensureQueryData(user.getThemePreferenceQueryOptions),
    ]);
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
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
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "48x48",
        href: "/favicon-48x48.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "96x96",
        href: "/favicon-96x96.png",
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
  const queryClient = useQueryClient();
  const bannerRecordUrls =
    queryClient.getQueryData<Record<string, string>>(
      getGeneratedBannerRecordUrlsQueryOptions.queryKey,
    ) ?? {};
  const bannerInitScript = `window.__GENERATED_BANNER_RECORD_URLS__=${safeJsonForScript(
    bannerRecordUrls,
  )};`;

  // Read theme from the prefilled query cache (populated by `beforeLoad`).
  // Subscribing via `useQuery` lets the menu's mutation re-render <html>.
  const { data: themePreference } = useQuery({
    ...user.getThemePreferenceQueryOptions,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const themeMode = themePreference?.mode ?? DEFAULT_THEME_MODE;

  // Read the current locale from the URL via `useMatches` — `$locale` is the
  // first match below `__root__` for any user-facing page. API / OG paths
  // won't match it, so we fall back to the default.
  const matches = useMatches();
  const localeMatch = matches.find(
    (m) =>
      typeof m.params === "object" &&
      m.params !== null &&
      "locale" in (m.params as Record<string, unknown>),
  );
  const currentLocale: Locale = parseLocale(
    (localeMatch?.params as { locale?: string } | undefined)?.locale ??
      DEFAULT_LOCALE,
  );

  return (
    <html
      lang={currentLocale}
      dir={localeDirection(currentLocale)}
      data-theme={themeMode}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: bannerInitScript }} />
        <HeadContent />
      </head>
      <body {...stylex.props(primaryColorTheme, styles.body)}>
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
