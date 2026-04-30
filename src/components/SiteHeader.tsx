import * as stylex from "@stylexjs/stylex";
import { createLink, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { AtStoreLogo } from "./AtStoreLogo";
import { NavbarAuth } from "./NavbarAuth";
import { IconButton } from "../design-system/icon-button";
import {
  Navbar,
  NavbarAction,
  NavbarLink,
  NavbarLogo,
  NavbarNavigation,
} from "../design-system/navbar";
import { containerBreakpoints } from "../design-system/theme/media-queries.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { gap } from "../design-system/theme/semantic-spacing.stylex";

const NavbarLogoLink = createLink(NavbarLogo);
const NavbarLinkLink = createLink(NavbarLink);
const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  logoContent: {
    alignItems: "center",
    display: "flex",
    fontSize: fontSize["2xl"],
    gap: "8px",
    textDecoration: "none",
  },
  mobileSearchLink: {
    display: {
      default: "flex",
      [containerBreakpoints.sm]: "none",
    },
  },
  desktopSearchLink: {
    display: {
      default: "none",
      [containerBreakpoints.sm]: "inline-flex",
    },
  },
  navbarAction: {
    gap: gap["lg"],
  },
});

export function SiteHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <Navbar>
      <NavbarLogoLink to="/" style={styles.logoContent}>
        <AtStoreLogo variant="navbar" />
      </NavbarLogoLink>
      <NavbarNavigation justify="right">
        <NavbarLinkLink to="/about" isActive={pathname.startsWith("/about")}>
          About
        </NavbarLinkLink>
        <NavbarLinkLink
          to="/search"
          isActive={pathname.startsWith("/search")}
          style={styles.mobileSearchLink}
          search={{ sort: "popular" }}
        >
          Search
        </NavbarLinkLink>
        <div {...stylex.props(styles.mobileSearchLink)}>
          <NavbarAuth />
        </div>
      </NavbarNavigation>
      <NavbarAction alwaysVisible={true}>
        <IconButtonLink
          to="/search"
          search={{ sort: "popular" }}
          aria-label="Search listings"
          variant="tertiary"
          size="lg"
        >
          <Search />
        </IconButtonLink>
        <div {...stylex.props(styles.desktopSearchLink)}>
          <NavbarAuth />
        </div>
      </NavbarAction>
    </Navbar>
  );
}
