import * as stylex from "@stylexjs/stylex";
import { createLink, useRouterState } from "@tanstack/react-router";

import { AtStoreLogo } from "./AtStoreLogo";
import { NavbarAuth } from "./NavbarAuth";
import {
  Navbar,
  NavbarLink,
  NavbarLogo,
  NavbarNavigation,
} from "../design-system/navbar";
import { fontSize } from "../design-system/theme/typography.stylex";

const NavbarLogoLink = createLink(NavbarLogo);
const NavbarLinkLink = createLink(NavbarLink);

const styles = stylex.create({
  logoContent: {
    alignItems: "center",
    display: "flex",
    fontSize: fontSize["2xl"],
    gap: "8px",
    textDecoration: "none",
  },
});

export function SiteHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <Navbar>
      <NavbarLogoLink to="/home" style={styles.logoContent}>
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
  );
}
