import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as stylex from "@stylexjs/stylex";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getGeneratedBannerRecordUrlsQueryOptions } from "../integrations/tanstack-query/api-banner-record-urls.functions";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { primaryColor } from "../design-system/theme/color.stylex";
import { blue } from "../design-system/theme/colors/blue.stylex";

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

type ThemeMode = "light" | "dark" | "auto";

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }

  return "auto";
}

function applyThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") {
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  if (mode === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }

  root.style.colorScheme = resolved;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

/**
 * Safely serializes a JSON object for embedding inside a `<script>` tag.
 * Escapes `</` so a stray `</script>` inside a value can't close the tag.
 */
function safeJsonForScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(user.getSessionQueryOptions),
      context.queryClient.ensureQueryData(
        getGeneratedBannerRecordUrlsQueryOptions,
      ),
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
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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

function ThemeModeSync() {
  useEffect(() => {
    const syncTheme = () => {
      applyThemeMode(getStoredThemeMode());
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    syncTheme();
    media.addEventListener("change", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      media.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const bannerRecordUrls =
    queryClient.getQueryData<Record<string, string>>(
      getGeneratedBannerRecordUrlsQueryOptions.queryKey,
    ) ?? {};
  const bannerInitScript = `window.__GENERATED_BANNER_RECORD_URLS__=${safeJsonForScript(
    bannerRecordUrls,
  )};`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: bannerInitScript }} />
        <HeadContent />
      </head>
      <body {...stylex.props(primaryColorTheme)}>
        <ThemeModeSync />
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
