import * as stylex from "@stylexjs/stylex";
import { useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AtStoreLogo } from "./AtStoreLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavbarAuth } from "./NavbarAuth";
import { createLocaleLink } from "./LocaleLink";
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

const NavbarLogoLink = createLocaleLink(NavbarLogo);
const NavbarLinkLink = createLocaleLink(NavbarLink);
const IconButtonLink = createLocaleLink(IconButton);

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
  const { t } = useTranslation("common");

  return (
    <Navbar>
      <NavbarLogoLink to="/$locale" style={styles.logoContent}>
        <AtStoreLogo variant="navbar" />
      </NavbarLogoLink>
      <NavbarNavigation justify="right">
        <NavbarLinkLink
          to="/$locale/home"
          isActive={pathname.includes("/apps/")}
        >
          {t("siteHeader.apps")}
        </NavbarLinkLink>
        <NavbarLinkLink
          to="/$locale/search"
          isActive={pathname.includes("/search")}
          style={styles.mobileSearchLink}
          search={{ sort: "popular" }}
        >
          {t("siteHeader.search")}
        </NavbarLinkLink>
      </NavbarNavigation>
      <NavbarAction style={styles.navbarAction}>
        <IconButtonLink
          to="/$locale/search"
          search={{ sort: "popular" }}
          aria-label={t("siteHeader.searchListingsAriaLabel")}
          variant="secondary"
          style={styles.desktopSearchLink}
        >
          <Search />
        </IconButtonLink>
        <LanguageSwitcher />
        <NavbarAuth />
      </NavbarAction>
    </Navbar>
  );
}
