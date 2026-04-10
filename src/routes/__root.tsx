import {
  HeadContent,
  Scripts,
  createLink,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useEffect } from "react";
import * as stylex from "@stylexjs/stylex";

import { Footer } from "../design-system/footer";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import {
  Navbar,
  NavbarLink,
  NavbarLogo,
  NavbarNavigation,
} from "../design-system/navbar";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { primaryColor } from "../design-system/theme/color.stylex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";

const NavbarLogoLink = createLink(NavbarLogo);
const NavbarLinkLink = createLink(NavbarLink);
const FooterLink = createLink(Link);

const styles = stylex.create({
  logoText: {
    color: blue.solid1,
    fontWeight: "bold",
  },
  logoContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: fontSize["2xl"],
    textDecoration: "none",
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

// const SHELL_NAV_ITEMS = [
//   { href: "/apps/tags", label: "Apps" },
//   { href: "/protocol/tags", label: "Protocol" },
// ] as const;

const FOOTER_LINK_GROUPS = [
  {
    title: "Apps",
    links: [
      { href: "/apps/all", label: "All Apps" },
      { href: "/apps/tags", label: "Categories" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { href: "/protocol/listings", label: "All Tools" },
      { href: "/protocol/tags", label: "Categories" },
    ],
  },
] as const;

export const Route = createRootRouteWithContext<MyRouterContext>()({
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

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <Navbar>
          <NavbarLogoLink to="/" style={styles.logoContent}>
            <span {...stylex.props(styles.logoText)}>AT</span>Store
          </NavbarLogoLink>
          <NavbarNavigation justify="right">
            <NavbarLinkLink
              to="/apps/tags"
              isActive={pathname.startsWith("/apps/")}
            >
              Apps
            </NavbarLinkLink>
            <NavbarLinkLink
              to="/protocol/tags"
              isActive={pathname.startsWith("/protocol/")}
            >
              Protocol
            </NavbarLinkLink>
          </NavbarNavigation>
        </Navbar>
      </HeaderLayout.Header>

      {children}

      <HeaderLayout.Footer>
        <Footer.Root>
          <Footer.Section>
            <Footer.Logo>at-store</Footer.Logo>
            <Footer.NavSection>
              {FOOTER_LINK_GROUPS.map((group) => (
                <Footer.NavGroup key={group.title} title={group.title}>
                  {group.links.map((link) => (
                    <FooterLink key={link.href} to={link.href as never}>
                      {link.label}
                    </FooterLink>
                  ))}
                </Footer.NavGroup>
              ))}
            </Footer.NavSection>
          </Footer.Section>

          <Footer.Section>
            <Footer.Copyright>
              {new Date().getFullYear()} at-store. Discover apps and protocol
              tooling across the Bluesky ecosystem.
            </Footer.Copyright>
          </Footer.Section>
        </Footer.Root>
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body {...stylex.props(primaryColorTheme)}>
        <ThemeModeSync />
        <AppShell>{children}</AppShell>
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
