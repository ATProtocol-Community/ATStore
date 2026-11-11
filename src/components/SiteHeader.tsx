import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { notificationApi } from "#/integrations/tanstack-query/api-notification.functions.ts";
import { user } from "#/integrations/tanstack-query/api-user.functions.ts";
import { useNotificationReadState } from "#/lib/notification-read-state.ts";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "../design-system/icon-button";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontFamily } from "../design-system/theme/typography.stylex";
import { AtStoreLogo } from "./AtStoreLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavbarAuth } from "./NavbarAuth";
import { NotificationsBell } from "./NotificationsBell";

const IconButtonLink = createLink(IconButton);

type NavSection = "apps" | "games" | "tags" | "data";

/** Which top-level section a path belongs to, for the active nav item. */
function getNavSection(pathname: string): NavSection | null {
  if (pathname.startsWith("/games")) return "games";
  if (pathname.startsWith("/apps/tags")) return "tags";
  if (pathname.startsWith("/apps/lexicon")) return "data";
  if (
    pathname === "/apps" ||
    pathname.startsWith("/apps/") ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/ecosystems/") ||
    pathname.startsWith("/categories/")
  ) {
    return pathname.startsWith("/products/create") ||
      pathname.startsWith("/products/manage")
      ? null
      : "apps";
  }
  return null;
}

const styles = stylex.create({
  bar: {
    marginInline: "auto",
    paddingInline: { default: 20, [breakpoints.sm]: 40 },
    alignItems: "center",
    boxSizing: "border-box",
    columnGap: { default: 12, [breakpoints.md]: 36 },
    display: "flex",
    height: { default: 56, [breakpoints.md]: 64 },
    maxWidth: "var(--page-content-max-width)",
    width: "100%",
  },
  logo: {
    textDecoration: "none",
    display: "flex",
    flexShrink: 0,
  },
  nav: {
    alignSelf: "stretch",
    columnGap: 26,
    display: { default: "none", [breakpoints.md]: "flex" },
  },
  navLink: {
    textDecoration: "none",
    alignItems: "center",
    alignSelf: "stretch",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    display: "flex",
    fontSize: 15,
    position: "relative",
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    whiteSpace: "nowrap",
  },
  navLinkActive: {
    color: uiColor.text2,
    fontWeight: 550,
    // Underline sits on the header's bottom rule.
    "::after": {
      borderRadius: 2,
      backgroundColor: uiColor.text2,
      content: "''",
      position: "absolute",
      bottom: -1,
      height: 2,
      left: 0,
      right: 0,
    },
  },
  actions: {
    alignItems: "center",
    columnGap: 8,
    display: "flex",
    marginLeft: "auto",
  },
  search: {
    borderColor: {
      default: uiColor.border1,
      ":focus-within": uiColor.text2,
      ":hover": uiColor.border2,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    color: uiColor.text1,
    columnGap: 10,
    display: { default: "none", [breakpoints.lg]: "flex" },
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    height: 40,
    marginRight: 8,
    paddingLeft: 14,
    paddingRight: 8,
    width: 320,
  },
  searchInput: {
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: uiColor.text2,
    flexGrow: 1,
    fontFamily: fontFamily.sans,
    fontSize: 14,
    minWidth: 0,
    "::placeholder": {
      color: uiColor.text1,
    },
  },
  kbd: {
    borderColor: uiColor.border1,
    borderRadius: 6,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 4,
    paddingInline: 6,
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 1,
  },
  searchIcon: {
    display: { default: "inline-flex", [breakpoints.lg]: "none" },
  },
  mobileNav: {
    paddingInline: 20,
    alignItems: "center",
    columnGap: 20,
    display: { default: "flex", [breakpoints.md]: "none" },
    scrollbarWidth: "none",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    height: 44,
    overflowX: "auto",
  },
});

function HeaderSearch() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search from anywhere that isn't already a text field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      {...stylex.props(styles.search)}
      onSubmit={(event) => {
        event.preventDefault();
        const q = query.trim();
        void navigate({ to: "/apps", search: q ? { q } : {} });
        setQuery("");
        inputRef.current?.blur();
      }}
    >
      <Search size={16} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t("siteHeader.searchListingsLabel")}
        placeholder={t("siteHeader.searchPlaceholder")}
        {...stylex.props(styles.searchInput)}
      />
      <kbd aria-hidden {...stylex.props(styles.kbd)}>
        /
      </kbd>
    </form>
  );
}

function NavLinks({ section }: { section: NavSection | null }) {
  const { t } = useTranslation("common");
  const items = [
    { key: "apps", to: "/apps", label: t("siteHeader.nav.browse") },
    { key: "games", to: "/games", label: t("siteHeader.nav.games") },
    { key: "tags", to: "/apps/tags", label: t("siteHeader.nav.tags") },
    {
      key: "data",
      to: "/apps/lexicons",
      label: t("siteHeader.nav.sharedData"),
    },
  ] as const;

  return items.map((item) => (
    <RouterLink
      key={item.key}
      to={item.to}
      aria-current={section === item.key ? "page" : undefined}
      {...stylex.props(
        styles.navLink,
        section === item.key && styles.navLinkActive,
      )}
    >
      {item.label}
    </RouterLink>
  ));
}

/**
 * Shelf site header: wordmark, section links with an underline on the
 * header's bottom rule, a pill search with a "/" shortcut, and account
 * actions. Below `md` the links move to a scrollable strip under the bar.
 */
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = getNavSection(pathname);

  return (
    <>
      <div {...stylex.props(styles.bar)}>
        <RouterLink
          to="/"
          aria-label="at-store home"
          {...stylex.props(styles.logo)}
        >
          <AtStoreLogo />
        </RouterLink>
        <nav aria-label="Main" {...stylex.props(styles.nav)}>
          <NavLinks section={section} />
        </nav>
        <div {...stylex.props(styles.actions)}>
          <HeaderSearch />
          <IconButtonLink
            to="/apps"
            label={t("siteHeader.searchListingsLabel")}
            variant="secondary"
            size="md"
            style={styles.searchIcon}
          >
            <Search />
          </IconButtonLink>
          <NotificationsBell unreadCount={unreadCount} />
          <LanguageSwitcher />
          <NavbarAuth />
        </div>
      </div>
      <nav aria-label="Main" {...stylex.props(styles.mobileNav)}>
        <NavLinks section={section} />
      </nav>
    </>
  );
}
