import { createLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { Locale } from "../lib/locale";

import { Footer } from "../design-system/footer";
import { Link } from "../design-system/link";
import { useLocale } from "../lib/LocaleContext";
import { AtStoreLogo } from "./AtStoreLogo";

const FooterLink = createLink(Link);

type LocaleLink = {
  kind: "locale";
  to: "/$locale" | "/$locale/about";
  tKey: string;
};
type SearchLink = {
  kind: "search";
  to: "/search" | "/apps/all";
  search: { sort: "popular" };
  tKey: string;
};
type PlainLink = {
  kind: "plain";
  to:
    | "/developers/atproto"
    | "/products/manage"
    | "/apps/tags"
    | "/apps/lexicons";
  tKey: string;
};
type FooterLinkDef = LocaleLink | SearchLink | PlainLink;

const LINK_GROUPS: Array<{ titleKey?: string; links: Array<FooterLinkDef> }> = [
  {
    links: [
      { kind: "locale", to: "/$locale/about", tKey: "siteFooter.nav.about" },
      { kind: "locale", to: "/$locale", tKey: "siteFooter.nav.home" },
      {
        kind: "search",
        to: "/search",
        search: { sort: "popular" },
        tKey: "siteFooter.nav.search",
      },
      {
        kind: "plain",
        to: "/developers/atproto",
        tKey: "siteFooter.nav.developerApi",
      },
      {
        kind: "plain",
        to: "/products/manage",
        tKey: "siteFooter.nav.manageListings",
      },
    ],
  },
  {
    titleKey: "siteFooter.apps.groupTitle",
    links: [
      {
        kind: "search",
        to: "/apps/all",
        search: { sort: "popular" },
        tKey: "siteFooter.apps.allApps",
      },
      { kind: "plain", to: "/apps/tags", tKey: "siteFooter.apps.categories" },
      {
        kind: "plain",
        to: "/apps/lexicons",
        tKey: "siteFooter.apps.sharedData",
      },
    ],
  },
];

function renderLink(link: FooterLinkDef, locale: Locale, label: string) {
  switch (link.kind) {
    case "locale": {
      return (
        <FooterLink key={link.to} to={link.to} params={{ locale }}>
          {label}
        </FooterLink>
      );
    }
    case "search": {
      return (
        <FooterLink key={link.to} to={link.to} search={link.search}>
          {label}
        </FooterLink>
      );
    }
    case "plain": {
      return (
        <FooterLink key={link.to} to={link.to}>
          {label}
        </FooterLink>
      );
    }
  }
}

export function SiteFooter() {
  const { locale } = useLocale();
  const { t } = useTranslation("common");

  return (
    <Footer.Root>
      <Footer.Section>
        <Footer.Logo>
          <AtStoreLogo />
        </Footer.Logo>
        <Footer.NavSection>
          {LINK_GROUPS.map((group, i) => (
            <Footer.NavGroup
              key={i}
              title={group.titleKey ? t(group.titleKey as never) : undefined}
            >
              {group.links.map((link) =>
                renderLink(link, locale, t(link.tKey as never)),
              )}
            </Footer.NavGroup>
          ))}
        </Footer.NavSection>
      </Footer.Section>

      <Footer.Section>
        <Footer.Copyright>
          {t("siteFooter.copyright", { year: new Date().getFullYear() })}
        </Footer.Copyright>
      </Footer.Section>
    </Footer.Root>
  );
}
