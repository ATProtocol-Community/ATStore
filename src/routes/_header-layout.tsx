import {
  Outlet,
  createFileRoute,
  createLink,
  useRouterState,
} from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";

import { AtStoreLogo } from "../components/AtStoreLogo";
import { NavbarAuth } from "../components/NavbarAuth";
import { Footer } from "../design-system/footer";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import {
  Navbar,
  NavbarLink,
  NavbarLogo,
  NavbarNavigation,
} from "../design-system/navbar";
import { fontSize } from "../design-system/theme/typography.stylex";
import { Suspense } from "react";

const NavbarLogoLink = createLink(NavbarLogo);
const NavbarLinkLink = createLink(NavbarLink);
const FooterLink = createLink(Link);

const styles = stylex.create({
  logoContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: fontSize["2xl"],
    textDecoration: "none",
  },
});

const FOOTER_LINK_GROUPS = [
  {
    title: "Apps",
    links: [
      { href: "/apps/all", label: "All Apps" },
      { href: "/apps/tags", label: "Categories" },
    ],
  },
  {
    title: "Protocol Tools",
    links: [
      { href: "/protocol/listings", label: "All Tools" },
      { href: "/protocol/tags", label: "Categories" },
    ],
  },
] as const;

export const Route = createFileRoute("/_header-layout")({
  component: HeaderLayoutRoute,
});

function HeaderLayoutRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <Navbar>
          <NavbarLogoLink to="/" style={styles.logoContent}>
            <AtStoreLogo variant="navbar" />
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
              Protocol Tools
            </NavbarLinkLink>
          </NavbarNavigation>
          <NavbarAuth />
        </Navbar>
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <Suspense>
          <Outlet />
        </Suspense>
      </HeaderLayout.Page>

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
