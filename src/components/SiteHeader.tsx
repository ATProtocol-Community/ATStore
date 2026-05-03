import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { notificationApi } from "#/integrations/tanstack-query/api-notification.functions.ts";
import { user } from "#/integrations/tanstack-query/api-user.functions.ts";
import { useNotificationReadState } from "#/lib/notification-read-state.ts";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { Navbar, NavbarAction, NavbarLogo } from "../design-system/navbar";
import { fontSize } from "../design-system/theme/typography.stylex";
import { AtStoreLogo } from "./AtStoreLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavbarAuth } from "./NavbarAuth";
import { NotificationsBell } from "./NotificationsBell";

const NavbarLogoLink = createLink(NavbarLogo);
const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  logoContent: {
    alignItems: "center",
    columnGap: "8px",
    display: "flex",
    fontSize: fontSize["2xl"],
    rowGap: "8px",
  },
});

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
    <Navbar hideHamburgerButton={true}>
      <NavbarLogoLink to="/" style={styles.logoContent} hasUnderline={false}>
        <AtStoreLogo variant="navbar" />
      </NavbarLogoLink>

      <NavbarAction alwaysVisible={true}>
        <Flex align="center" gap="md">
          <IconButtonLink
            to="/search"
            search={{ sort: "popular" }}
            label={t("siteHeader.searchListingsLabel")}
            variant="tertiary"
            size="lg"
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
