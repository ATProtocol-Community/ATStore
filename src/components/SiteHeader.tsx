import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { notificationApi } from "#/integrations/tanstack-query/api-notification.functions.ts";
import { user } from "#/integrations/tanstack-query/api-user.functions.ts";
import { useNotificationReadState } from "#/lib/notification-read-state.ts";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import {
  Navbar,
  NavbarAction,
  NavbarLink,
  NavbarLogo,
  NavbarNavigation,
} from "../design-system/navbar";
import { SearchField } from "../design-system/search-field";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { AtStoreLogo } from "./AtStoreLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavbarAuth } from "./NavbarAuth";
import { NotificationsBell } from "./NotificationsBell";

const NavbarLogoLink = createLink(NavbarLogo);
const NavbarLinkLink = createLink(NavbarLink);
const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  logoContent: {
    alignItems: "center",
    columnGap: "8px",
    display: "flex",
    fontSize: fontSize["2xl"],
    rowGap: "8px",
  },
  searchField: {
    display: {
      default: "none",
      [breakpoints.lg]: "block",
    },
    width: "18rem",
  },
  searchButton: {
    display: {
      default: "flex",
      [breakpoints.lg]: "none",
    },
  },
});

function HeaderSearch() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");

  return (
    <div {...stylex.props(styles.searchField)}>
      <SearchField
        aria-label={t("siteHeader.searchListingsLabel")}
        placeholder={t("siteHeader.searchPlaceholder")}
        value={query}
        onChange={setQuery}
        onSubmit={(value) => {
          const q = value.trim();
          void navigate({ to: "/apps", search: q ? { q } : {} });
          setQuery("");
        }}
        variant="secondary"
      />
    </div>
  );
}

export function SiteHeader() {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: notifications } = useQuery({
    ...notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
    enabled: session?.user != null,
  });
  const { unreadCount } = useNotificationReadState(
    session?.user?.did ?? null,
    notifications ?? [],
  );
  const { t } = useTranslation("common");

  return (
    <Navbar>
      <NavbarLogoLink to="/" style={styles.logoContent} hasUnderline={false}>
        <AtStoreLogo variant="navbar" />
      </NavbarLogoLink>

      <NavbarNavigation>
        <NavbarLinkLink
          to="/apps"
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={{ isActive: true }}
        >
          {t("siteHeader.nav.browse")}
        </NavbarLinkLink>
        <NavbarLinkLink to="/apps/tags" activeProps={{ isActive: true }}>
          {t("siteHeader.nav.tags")}
        </NavbarLinkLink>
        <NavbarLinkLink to="/apps/lexicons" activeProps={{ isActive: true }}>
          {t("siteHeader.nav.sharedData")}
        </NavbarLinkLink>
      </NavbarNavigation>

      <NavbarAction alwaysVisible={true}>
        <Flex align="center" gap="md">
          <HeaderSearch />
          <IconButtonLink
            to="/apps"
            label={t("siteHeader.searchListingsLabel")}
            variant="tertiary"
            size="lg"
            style={styles.searchButton}
          >
            <Search />
          </IconButtonLink>
          <NotificationsBell unreadCount={unreadCount} />
          <LanguageSwitcher />
          <NavbarAuth />
        </Flex>
      </NavbarAction>
    </Navbar>
  );
}
