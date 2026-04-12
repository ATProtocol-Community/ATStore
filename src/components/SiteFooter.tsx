import { createLink } from "@tanstack/react-router";

import { Footer } from "../design-system/footer";
import { Link } from "../design-system/link";
import { AtStoreLogo } from "./AtStoreLogo";

const FooterLink = createLink(Link);

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

export function SiteFooter() {
  return (
    <Footer.Root>
      <Footer.Section>
        <Footer.Logo>
          <AtStoreLogo />
        </Footer.Logo>
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
  );
}
